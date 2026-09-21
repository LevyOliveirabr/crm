import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import {
  adicionarDiasISO,
  hojeISO,
  inicioMesAtualISO,
  inicioMesISO,
  inicioProximoMesISO,
} from "@/lib/format";
import type {
  BarraTrimestre,
  DadosDashboard,
  EtapaFunil,
  FiltrosDashboard,
  FunilDashboard,
  Kpis,
  LinhaBase,
  MotivoPerdaItem,
  NegociacaoResumo,
  OpcoesDashboard,
  QuebraItem,
  TipoSegmento,
} from "@/lib/dashboard/tipos";

type Client = SupabaseClient<Database>;

/** Dias sem interação a partir dos quais a negociação entra em "risco". */
export const DIAS_RISCO_PADRAO = 15;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Valor de previsão efetivo: valor_previsao ou fallback no potencial. */
export function valorPrevisaoEfetivo(row: {
  valor_estimado: number | null;
  valor_previsao?: number | null;
}): number {
  if (row.valor_previsao != null && Number.isFinite(Number(row.valor_previsao))) {
    return num(row.valor_previsao);
  }
  return num(row.valor_estimado);
}

const COLUNAS_ABERTAS = `
  id, titulo, linha, origem, empresa_id, empresa_nome, empresa_uf, empresa_tipo_segmento, empresa_segmento,
  responsavel_id, responsavel_nome, funil_id, funil_nome, etapa_id, etapa_nome, etapa_ordem,
  valor_estimado, valor_previsao, negocio_unico, temperatura, previsao_mes, previsao_data, data_faturamento, criado_em,
  categoria_forecast, etapa_probabilidade,
  sem_acao, acao_atrasada, dias_sem_interacao, proxima_acao_data
`;

/** Sem as colunas da migration 0010 / 0006. */
const COLUNAS_ABERTAS_LEGADO = `
  id, titulo, linha, origem, empresa_id, empresa_nome,
  responsavel_id, responsavel_nome, funil_id, funil_nome, etapa_id, etapa_nome, etapa_ordem,
  valor_estimado, temperatura, previsao_mes, criado_em,
  sem_acao, acao_atrasada, dias_sem_interacao, proxima_acao_data
`;

type LinhaAberta = {
  id: string | null;
  titulo: string | null;
  linha: string | null;
  origem: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
  empresa_uf: string | null;
  empresa_tipo_segmento: TipoSegmento | null;
  empresa_segmento: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  funil_id: string | null;
  funil_nome: string | null;
  etapa_id: string | null;
  etapa_nome: string | null;
  etapa_ordem: number | null;
  valor_estimado: number | null;
  valor_previsao: number | null;
  negocio_unico: boolean | null;
  temperatura: number | null;
  previsao_mes: string | null;
  previsao_data: string | null;
  data_faturamento: string | null;
  categoria_forecast: "compromisso" | "provavel" | "possivel" | null;
  etapa_probabilidade: number | null;
  criado_em: string | null;
  sem_acao: boolean | null;
  acao_atrasada: boolean | null;
  dias_sem_interacao: number | null;
  proxima_acao_data: string | null;
};

type LinhaFechada = {
  id?: string | null;
  titulo?: string | null;
  empresa_id?: string | null;
  empresa_nome?: string | null;
  responsavel_nome?: string | null;
  etapa_nome?: string | null;
  status: "aberta" | "vendida" | "perdida" | null;
  valor_final: number | null;
  valor_estimado: number | null;
  valor_previsao?: number | null;
  motivo_perda?: string | null;
  fechado_em: string | null;
};

function aplicarFiltros<
  T extends {
    eq: (c: string, v: string) => T;
  },
>(query: T, f: FiltrosDashboard): T {
  let q = query;
  if (f.emitenteId) q = q.eq("emitente_id", f.emitenteId);
  if (f.vendedorId) q = q.eq("responsavel_id", f.vendedorId);
  if (f.etapaId) q = q.eq("etapa_id", f.etapaId);
  if (f.origem) q = q.eq("origem", f.origem);
  if (f.uf) q = q.eq("empresa_uf", f.uf);
  if (f.segmento) q = q.eq("empresa_tipo_segmento", f.segmento);
  if (f.tipoCliente) q = q.eq("empresa_segmento", f.tipoCliente);
  return q;
}

function pesoTemperatura(
  t: number | null,
  pesos: { fria: number; morna: number; quente: number },
): number {
  if (t === 1) return pesos.fria;
  if (t === 3) return pesos.quente;
  return pesos.morna;
}

/**
 * Peso da negociação no pipeline ponderado: probabilidade da etapa quando
 * cadastrada (0–100), senão o peso da temperatura.
 */
export function pesoNegociacao(
  row: { temperatura: number | null; etapa_probabilidade: number | null },
  pesos: { fria: number; morna: number; quente: number },
): number {
  if (row.etapa_probabilidade != null && Number.isFinite(Number(row.etapa_probabilidade))) {
    return Math.min(1, Math.max(0, Number(row.etapa_probabilidade) / 100));
  }
  return pesoTemperatura(row.temperatura, pesos);
}

/** Mês de previsão efetivo: sem previsão conta como o próximo mês (mesma regra de v_previsao). */
function mesPrevisao(row: LinhaAberta, hoje: string): string {
  return row.previsao_mes
    ? inicioMesISO(String(row.previsao_mes))
    : inicioProximoMesISO(hoje);
}

function trimestreDe(dataISO: string): { ano: number; trimestre: 1 | 2 | 3 | 4 } {
  const [y, m] = dataISO.split("-").map(Number);
  return { ano: y!, trimestre: (Math.floor((m! - 1) / 3) + 1) as 1 | 2 | 3 | 4 };
}

export function calcularWinRate(rows: {
  status: string | null;
  valor_final?: number | null;
  valor_estimado?: number | null;
}[]): {
  taxa: number | null;
  taxaNegocio: number | null;
  vendidas: number;
  perdidas: number;
} {
  const vendidas = rows.filter((r) => r.status === "vendida");
  const perdidas = rows.filter((r) => r.status === "perdida");
  const qVend = vendidas.length;
  const qPerd = perdidas.length;
  const totalQ = qVend + qPerd;
  const valorVend = vendidas.reduce((s, r) => s + num(r.valor_final), 0);
  const valorPerd = perdidas.reduce((s, r) => s + num(r.valor_estimado), 0);
  const totalV = valorVend + valorPerd;
  return {
    taxa: totalV > 0 ? Math.round((valorVend / totalV) * 1000) / 10 : null,
    taxaNegocio: totalQ > 0 ? Math.round((qVend / totalQ) * 1000) / 10 : null,
    vendidas: qVend,
    perdidas: qPerd,
  };
}

function winRate(rows: LinhaFechada[]) {
  return calcularWinRate(rows);
}

export async function carregarOpcoesDashboard(
  supabase: Client,
  vendedores: { id: string; nome: string }[],
): Promise<OpcoesDashboard> {
  const [{ data: etapas }, { data: ufsRaw }, { data: origens }, { data: tiposCliente }] =
    await Promise.all([
      supabase
        .from("etapas")
        .select("id, nome, ordem, funis!inner(nome, ordem, ativo)")
        .eq("ativo", true)
        .eq("funis.ativo", true)
        .order("ordem"),
      supabase
        .from("empresas")
        .select("uf")
        .is("arquivado_em", null)
        .not("uf", "is", null),
      supabase
        .from("listas")
        .select("valor")
        .eq("tipo", "origem")
        .eq("ativo", true)
        .order("ordem"),
      supabase
        .from("listas")
        .select("valor")
        .eq("tipo", "segmento")
        .eq("ativo", true)
        .order("ordem"),
    ]);

  type EtapaJoin = {
    id: string;
    nome: string;
    ordem: number;
    funis: { nome: string; ordem: number } | { nome: string; ordem: number }[] | null;
  };

  const etapasLista = ((etapas ?? []) as unknown as EtapaJoin[])
    .map((e) => {
      const f = Array.isArray(e.funis) ? e.funis[0] : e.funis;
      return {
        id: e.id,
        nome: e.nome,
        ordem: e.ordem,
        funil: f?.nome ?? "",
        funilOrdem: f?.ordem ?? 0,
      };
    })
    .sort((a, b) => a.funilOrdem - b.funilOrdem || a.ordem - b.ordem)
    .map(({ id, nome, funil }) => ({ id, nome, funil }));

  const ufs = [
    ...new Set(
      (ufsRaw ?? [])
        .map((r) => String(r.uf ?? "").trim().toUpperCase())
        .filter((u) => u.length === 2),
    ),
  ].sort();

  return {
    vendedores,
    etapas: etapasLista,
    ufs,
    origens: (origens ?? []).map((o) => o.valor),
    tiposCliente: (tiposCliente ?? []).map((t) => t.valor),
  };
}

export async function carregarDadosDashboard(
  supabase: Client,
  filtros: FiltrosDashboard,
): Promise<DadosDashboard> {
  const hoje = hojeISO();
  const mesAtual = inicioMesAtualISO();
  const mesSeguinte = inicioProximoMesISO(mesAtual);
  const anoAtual = Number(hoje.slice(0, 4));

  const ateExclusivo = adicionarDiasISO(filtros.ate, 1);
  const diasPeriodo = Math.max(
    1,
    Math.round(
      (Date.parse(`${ateExclusivo}T12:00:00Z`) -
        Date.parse(`${filtros.de}T12:00:00Z`)) /
        86_400_000,
    ),
  );
  const deAnterior = adicionarDiasISO(filtros.de, -diasPeriodo);

  // Primeiro tenta com as colunas da migration 0006; se o banco ainda não
  // tiver a migration, cai para as colunas antigas (sem filtro de UF/segmento).
  let abertasRaw: unknown[] | null = null;
  let filtrosEfetivos = filtros;
  {
    const res = await aplicarFiltros(
      supabase
        .from("v_negociacoes")
        .select(COLUNAS_ABERTAS)
        .eq("status", "aberta")
        .order("valor_estimado", { ascending: false }),
      filtros,
    );
    if (res.error) {
      filtrosEfetivos = {
        ...filtros,
        uf: null,
        segmento: null,
        tipoCliente: null,
      };
      const legado = await aplicarFiltros(
        supabase
          .from("v_negociacoes")
          .select(COLUNAS_ABERTAS_LEGADO)
          .eq("status", "aberta")
          .order("valor_estimado", { ascending: false }),
        filtrosEfetivos,
      );
      abertasRaw = legado.data;
    } else {
      abertasRaw = res.data;
    }
  }
  const filtros_ = filtrosEfetivos;

  const [
    { data: fechadasRaw },
    { data: fechadasAntRaw },
    { data: vendidasAnoRaw },
    { data: configRows },
    { data: etapasRaw },
    { data: vendidasMesRaw },
    { data: metasRaw },
  ] = await Promise.all([
    aplicarFiltros(
      supabase
        .from("v_negociacoes")
        .select(
          "id, titulo, empresa_id, empresa_nome, responsavel_nome, etapa_nome, status, valor_final, valor_estimado, valor_previsao, motivo_perda, fechado_em",
        )
        .in("status", ["vendida", "perdida"])
        .gte("fechado_em", `${filtros.de}T00:00:00-03:00`)
        .lt("fechado_em", `${ateExclusivo}T00:00:00-03:00`),
      filtros_,
    ),
    aplicarFiltros(
      supabase
        .from("v_negociacoes")
        .select("status, valor_final, valor_estimado, fechado_em")
        .in("status", ["vendida", "perdida"])
        .gte("fechado_em", `${deAnterior}T00:00:00-03:00`)
        .lt("fechado_em", `${filtros.de}T00:00:00-03:00`),
      filtros_,
    ),
    filtros.visao === "fechamento"
      ? aplicarFiltros(
          supabase
            .from("v_negociacoes")
            .select("status, valor_final, valor_estimado, fechado_em")
            .eq("status", "vendida")
            .gte("fechado_em", `${anoAtual}-01-01T00:00:00-03:00`)
            .lt("fechado_em", `${anoAtual + 2}-01-01T00:00:00-03:00`),
          filtros_,
        )
      : Promise.resolve({ data: [] as LinhaFechada[] }),
    supabase
      .from("config")
      .select("chave, valor")
      .in("chave", ["peso_fria", "peso_morna", "peso_quente", "dias_risco_dashboard"]),
    supabase
      .from("etapas")
      .select("id, nome, ordem, funil_id, funis!inner(id, nome, ordem, ativo)")
      .eq("ativo", true)
      .eq("funis.ativo", true),
    aplicarFiltros(
      supabase
        .from("v_negociacoes")
        .select("status, valor_final, valor_estimado, fechado_em")
        .eq("status", "vendida")
        .gte("fechado_em", `${mesAtual}T00:00:00-03:00`)
        .lt("fechado_em", `${mesSeguinte}T00:00:00-03:00`),
      filtros_,
    ),
    (() => {
      let q = supabase.from("metas").select("responsavel_id, valor").eq("mes", mesAtual);
      if (filtros.emitenteId) q = q.eq("emitente_id", filtros.emitenteId);
      if (filtros.vendedorId) q = q.eq("responsavel_id", filtros.vendedorId);
      else if (filtros.equipeIds && filtros.equipeIds.length > 0) q = q.in("responsavel_id", filtros.equipeIds);
      return q;
    })(),
  ]);

  const pesos = { fria: 0.2, morna: 0.5, quente: 0.8 };
  let diasRisco = DIAS_RISCO_PADRAO;
  for (const row of configRows ?? []) {
    if (row.chave === "peso_fria") pesos.fria = num(row.valor);
    if (row.chave === "peso_morna") pesos.morna = num(row.valor);
    if (row.chave === "peso_quente") pesos.quente = num(row.valor);
    if (row.chave === "dias_risco_dashboard") {
      diasRisco = Math.max(1, Math.round(num(row.valor)) || DIAS_RISCO_PADRAO);
    }
  }

  const abertas = ((abertasRaw ?? []) as unknown as Partial<LinhaAberta>[])
    .filter((r) => r.id)
    .map(
      (r): LinhaAberta => ({
        ...(r as LinhaAberta),
        empresa_uf: r.empresa_uf ?? null,
        empresa_tipo_segmento: r.empresa_tipo_segmento ?? null,
        empresa_segmento: r.empresa_segmento ?? null,
        data_faturamento: r.data_faturamento ?? null,
        previsao_data: r.previsao_data ?? null,
        categoria_forecast: r.categoria_forecast ?? null,
        etapa_probabilidade: r.etapa_probabilidade ?? null,
        valor_previsao: r.valor_previsao ?? null,
        negocio_unico: r.negocio_unico ?? true,
      }),
    );
  const vendidasMes = (vendidasMesRaw ?? []) as LinhaFechada[];
  const vendidoMes = vendidasMes.reduce((s, r) => s + num(r.valor_final), 0);
  const metaMes = (metasRaw ?? []).reduce((s, m) => s + num(m.valor), 0);
  const fechadas = (fechadasRaw ?? []) as LinhaFechada[];
  const fechadasAnt = (fechadasAntRaw ?? []) as LinhaFechada[];
  const vendidasAno = (vendidasAnoRaw ?? []) as LinhaFechada[];

  // ---------- KPIs ----------
  const metricaValor = (r: LinhaAberta) =>
    filtros.metrica === "previsao"
      ? valorPrevisaoEfetivo(r)
      : num(r.valor_estimado);

  const pipelineTotal = abertas.reduce((s, r) => s + num(r.valor_estimado), 0);
  const previsaoFaturamento = abertas.reduce(
    (s, r) => s + valorPrevisaoEfetivo(r),
    0,
  );
  const ponderadoDe = (rows: LinhaAberta[]) =>
    rows.reduce((s, r) => s + valorPrevisaoEfetivo(r) * pesoNegociacao(r, pesos), 0);
  const somaCategoria = (cat: LinhaAberta["categoria_forecast"]) =>
    abertas
      .filter((r) => r.categoria_forecast === cat)
      .reduce((s, r) => s + valorPrevisaoEfetivo(r), 0);
  const pipelinePonderado = ponderadoDe(abertas);

  const wr = winRate(fechadas);
  const wrAnt = winRate(fechadasAnt);

  const limite90 = adicionarDiasISO(hoje, 90);
  const previsao90 = abertas
    .filter((r) => {
      const ref = r.previsao_data ?? mesPrevisao(r, hoje);
      return ref >= hoje && ref <= limite90;
    })
    .reduce((s, r) => s + valorPrevisaoEfetivo(r), 0);

  const doMes = abertas.filter((r) => mesPrevisao(r, hoje) === mesAtual);
  const doMesSeguinte = abertas.filter(
    (r) => mesPrevisao(r, hoje) === mesSeguinte,
  );
  const triAtual = trimestreDe(hoje);
  const doTrimestre = abertas.filter((r) => {
    const t = trimestreDe(mesPrevisao(r, hoje));
    return t.ano === triAtual.ano && t.trimestre === triAtual.trimestre;
  });
  const triAnterior =
    triAtual.trimestre === 1
      ? { ano: triAtual.ano - 1, trimestre: 4 }
      : { ano: triAtual.ano, trimestre: triAtual.trimestre - 1 };
  const doTrimestreAnterior = abertas.filter((r) => {
    const t = trimestreDe(mesPrevisao(r, hoje));
    return t.ano === triAnterior.ano && t.trimestre === triAnterior.trimestre;
  });

  const kpis: Kpis = {
    pipelineTotal,
    qtdAbertas: abertas.length,
    previsaoFaturamento,
    previsaoPctPotencial:
      pipelineTotal > 0
        ? Math.round((previsaoFaturamento / pipelineTotal) * 100)
        : 0,
    pipelinePonderado,
    winRate: wr.taxa,
    winRateAnterior: wrAnt.taxa,
    winRateNegocio: wr.taxaNegocio,
    qtdVendidas: wr.vendidas,
    qtdPerdidas: wr.perdidas,
    previsao90,
    forecastMes: ponderadoDe(doMes),
    forecastMesQtd: doMes.length,
    forecastMesSeguinte: ponderadoDe(doMesSeguinte),
    forecastMesSeguinteQtd: doMesSeguinte.length,
    forecastTrimestre: ponderadoDe(doTrimestre),
    forecastTrimestreQtd: doTrimestre.length,
    forecastTrimestreAnterior: ponderadoDe(doTrimestreAnterior),
    mesAtual,
    mesSeguinte,
    vendidoMes,
    metaMes,
    forecastCompromisso: somaCategoria("compromisso"),
    forecastProvavel: somaCategoria("provavel"),
    forecastPossivel: somaCategoria("possivel"),
    forecastSemCategoria: somaCategoria(null),
  };

  // ---------- Barras por trimestre (ano atual + próximo) ----------
  const trimestres: BarraTrimestre[] = [];
  for (const ano of [anoAtual, anoAtual + 1]) {
    for (const trimestre of [1, 2, 3, 4] as const) {
      const atual = ano === triAtual.ano && trimestre === triAtual.trimestre;
      const futuro =
        ano > triAtual.ano ||
        (ano === triAtual.ano && trimestre > triAtual.trimestre);
      trimestres.push({ ano, trimestre, valor: 0, qtd: 0, atual, futuro });
    }
  }
  function somarNoTrimestre(dataISO: string | null, valor: number) {
    if (!dataISO) return;
    const t = trimestreDe(dataISO.slice(0, 10));
    const barra = trimestres.find(
      (b) => b.ano === t.ano && b.trimestre === t.trimestre,
    );
    if (!barra) return;
    barra.valor += valor;
    barra.qtd += 1;
  }
  if (filtros.visao === "fechamento") {
    for (const v of vendidasAno) {
      somarNoTrimestre(v.fechado_em, num(v.valor_final));
    }
  } else if (filtros.visao === "criacao") {
    for (const r of abertas) {
      somarNoTrimestre(r.criado_em, metricaValor(r));
    }
  } else {
    for (const r of abertas) {
      somarNoTrimestre(mesPrevisao(r, hoje), metricaValor(r));
    }
  }

  // ---------- Funil por etapa ----------
  type EtapaJoin = {
    id: string;
    nome: string;
    ordem: number;
    funil_id: string;
    funis: { id: string; nome: string; ordem: number } | { id: string; nome: string; ordem: number }[] | null;
  };
  const funisMap = new Map<
    string,
    { nome: string; ordem: number; etapas: Map<string, EtapaFunil> }
  >();
  for (const e of (etapasRaw ?? []) as unknown as EtapaJoin[]) {
    const f = Array.isArray(e.funis) ? e.funis[0] : e.funis;
    if (!f) continue;
    if (!funisMap.has(f.id)) {
      funisMap.set(f.id, { nome: f.nome, ordem: f.ordem, etapas: new Map() });
    }
    funisMap.get(f.id)!.etapas.set(e.id, {
      etapaId: e.id,
      nome: e.nome,
      ordem: e.ordem,
      qtd: 0,
      valor: 0,
    });
  }
  for (const r of abertas) {
    if (!r.funil_id || !r.etapa_id) continue;
    const f = funisMap.get(r.funil_id);
    const et = f?.etapas.get(r.etapa_id);
    if (!et) continue;
    et.qtd += 1;
    et.valor += metricaValor(r);
  }
  const funis: FunilDashboard[] = [...funisMap.entries()]
    .map(([funilId, f]) => {
      const etapas = [...f.etapas.values()].sort((a, b) => a.ordem - b.ordem);
      return {
        funilId,
        nome: f.nome,
        ordem: f.ordem,
        etapas,
        total: etapas.reduce((s, e) => s + e.valor, 0),
        qtd: etapas.reduce((s, e) => s + e.qtd, 0),
      };
    })
    // Funil com mais negociações primeiro; empata pela ordem cadastrada.
    .sort((a, b) => b.qtd - a.qtd || a.ordem - b.ordem)
    .map(({ funilId, nome, etapas, total, qtd }) => ({
      funilId,
      nome,
      etapas,
      total,
      qtd,
    }));

  // ---------- Próximos fechamentos (quente, previsão nos próximos 30 dias) ----------
  const limite30 = adicionarDiasISO(hoje, 30);
  const dataRef = (r: LinhaAberta) => r.previsao_data ?? mesPrevisao(r, hoje);
  const proximosFechamentos: NegociacaoResumo[] = abertas
    .filter((r) => {
      const quente = Number(r.temperatura) === 3 || r.categoria_forecast === "compromisso";
      if (!quente) return false;
      if (r.previsao_data) {
        return r.previsao_data >= hoje && r.previsao_data <= limite30;
      }
      const mes = mesPrevisao(r, hoje);
      const fimMes = adicionarDiasISO(inicioProximoMesISO(mes), -1);
      return mes <= limite30 && fimMes >= hoje;
    })
    .sort(
      (a, b) =>
        dataRef(a).localeCompare(dataRef(b)) ||
        metricaValor(b) - metricaValor(a),
    )
    .slice(0, 6)
    .map((r) => resumo(r, hoje));

  // ---------- Em risco ----------
  const emRisco: NegociacaoResumo[] = abertas
    .filter(
      (r) =>
        r.sem_acao === true ||
        r.acao_atrasada === true ||
        num(r.dias_sem_interacao) > diasRisco,
    )
    .sort((a, b) => metricaValor(b) - metricaValor(a))
    .slice(0, 6)
    .map((r) => {
      const motivos: string[] = [];
      if (r.acao_atrasada) {
        const dias = r.proxima_acao_data
          ? Math.round(
              (Date.parse(`${hoje}T12:00:00Z`) -
                Date.parse(`${r.proxima_acao_data}T12:00:00Z`)) /
                86_400_000,
            )
          : 0;
        motivos.push(dias > 0 ? `ação atrasada ${dias}d` : "ação atrasada");
      } else if (r.sem_acao) {
        motivos.push("sem próxima ação");
      }
      if (num(r.dias_sem_interacao) > diasRisco) {
        motivos.push("sem interação");
      }
      return {
        ...resumo(r, hoje),
        motivo: motivos.join(" · "),
        diasSemInteracao: num(r.dias_sem_interacao),
      };
    });

  // ---------- Top 10 / quebras / fechados / motivos ----------
  const top10: NegociacaoResumo[] = [...abertas]
    .sort((a, b) => metricaValor(b) - metricaValor(a))
    .slice(0, 10)
    .map((r) => resumo(r, hoje));

  function agregarQuebra(
    chaveDe: (r: LinhaAberta) => string | null | undefined,
  ): QuebraItem[] {
    const map = new Map<string, QuebraItem>();
    for (const r of abertas) {
      const label = (chaveDe(r) ?? "").trim() || "Sem classificação";
      const cur = map.get(label) ?? { chave: label, label, qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += metricaValor(r);
      map.set(label, cur);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  const porTipoCliente = agregarQuebra((r) => r.empresa_segmento);
  const porOrigem = agregarQuebra((r) => r.origem);

  const fechadosPeriodo: NegociacaoResumo[] = fechadas
    .filter((r) => r.status === "vendida" || r.status === "perdida")
    .sort(
      (a, b) =>
        String(b.fechado_em ?? "").localeCompare(String(a.fechado_em ?? "")) ||
        num(b.valor_final ?? b.valor_estimado) -
          num(a.valor_final ?? a.valor_estimado),
    )
    .slice(0, 12)
    .map((r) => ({
      id: r.id ?? "",
      titulo: r.titulo ?? "Sem título",
      empresaNome: r.empresa_nome ?? "—",
      empresaId: r.empresa_id ?? "",
      responsavelNome: r.responsavel_nome ?? "—",
      etapaNome: r.etapa_nome ?? "—",
      valor:
        r.status === "vendida" ? num(r.valor_final) : num(r.valor_estimado),
      valorPrevisao: valorPrevisaoEfetivo(r),
      previsaoMes: null,
      previsaoData: null,
      status: r.status ?? undefined,
      motivoPerda: r.motivo_perda ?? null,
    }));

  const motivosMap = new Map<string, MotivoPerdaItem>();
  for (const r of fechadas.filter((x) => x.status === "perdida")) {
    const motivo = (r.motivo_perda ?? "").trim() || "Sem motivo";
    const cur = motivosMap.get(motivo) ?? { motivo, qtd: 0, valor: 0 };
    cur.qtd += 1;
    cur.valor += num(r.valor_estimado);
    motivosMap.set(motivo, cur);
  }
  const motivosPerda = [...motivosMap.values()].sort(
    (a, b) => b.valor - a.valor,
  );

  // ---------- Base de dados ----------
  const base: LinhaBase[] = abertas.map((r) => ({
    id: r.id!,
    titulo: r.titulo ?? "Sem título",
    linha: r.linha,
    empresaId: r.empresa_id ?? "",
    empresaNome: r.empresa_nome ?? "—",
    responsavelNome: r.responsavel_nome ?? "—",
    etapaNome: r.etapa_nome ?? "—",
    segmento: r.empresa_tipo_segmento,
    tipoCliente: r.empresa_segmento,
    origem: r.origem,
    valor: num(r.valor_estimado),
    valorPrevisao: valorPrevisaoEfetivo(r),
    negocioUnico: r.negocio_unico !== false,
    previsaoMes: r.previsao_mes,
    previsaoData: r.previsao_data,
    dataFaturamento: r.data_faturamento,
    temperatura: Number(r.temperatura ?? 2),
    categoriaForecast: r.categoria_forecast,
  }));

  return {
    kpis,
    trimestres,
    funis,
    porTipoCliente,
    porOrigem,
    top10,
    fechadosPeriodo,
    motivosPerda,
    proximosFechamentos,
    emRisco,
    base,
    pesos,
    diasRisco,
  };
}

function resumo(r: LinhaAberta, hoje: string): NegociacaoResumo {
  return {
    id: r.id!,
    titulo: r.titulo ?? "Sem título",
    empresaNome: r.empresa_nome ?? "—",
    empresaId: r.empresa_id ?? "",
    responsavelNome: r.responsavel_nome ?? "—",
    etapaNome: r.etapa_nome ?? "—",
    valor: num(r.valor_estimado),
    valorPrevisao: valorPrevisaoEfetivo(r),
    previsaoMes: r.previsao_mes ? mesPrevisao(r, hoje) : null,
    previsaoData: r.previsao_data,
  };
}
