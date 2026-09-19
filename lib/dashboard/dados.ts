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
  NegociacaoResumo,
  OpcoesDashboard,
  TipoSegmento,
} from "@/lib/dashboard/tipos";

type Client = SupabaseClient<Database>;

/** Dias sem interação a partir dos quais a negociação entra em "risco". */
export const DIAS_RISCO_PADRAO = 15;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const COLUNAS_ABERTAS = `
  id, titulo, linha, origem, empresa_id, empresa_nome, empresa_uf, empresa_tipo_segmento,
  responsavel_id, responsavel_nome, funil_id, funil_nome, etapa_id, etapa_nome, etapa_ordem,
  valor_estimado, temperatura, previsao_mes, data_faturamento, criado_em,
  sem_acao, acao_atrasada, dias_sem_interacao, proxima_acao_data
`;

/** Sem as colunas da migration 0006 (empresa_uf, empresa_tipo_segmento, data_faturamento). */
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
  responsavel_id: string | null;
  responsavel_nome: string | null;
  funil_id: string | null;
  funil_nome: string | null;
  etapa_id: string | null;
  etapa_nome: string | null;
  etapa_ordem: number | null;
  valor_estimado: number | null;
  temperatura: number | null;
  previsao_mes: string | null;
  data_faturamento: string | null;
  criado_em: string | null;
  sem_acao: boolean | null;
  acao_atrasada: boolean | null;
  dias_sem_interacao: number | null;
  proxima_acao_data: string | null;
};

type LinhaFechada = {
  status: "aberta" | "vendida" | "perdida" | null;
  valor_final: number | null;
  valor_estimado: number | null;
  fechado_em: string | null;
};

function aplicarFiltros<
  T extends {
    eq: (c: string, v: string) => T;
  },
>(query: T, f: FiltrosDashboard): T {
  let q = query;
  if (f.vendedorId) q = q.eq("responsavel_id", f.vendedorId);
  if (f.etapaId) q = q.eq("etapa_id", f.etapaId);
  if (f.origem) q = q.eq("origem", f.origem);
  if (f.uf) q = q.eq("empresa_uf", f.uf);
  if (f.segmento) q = q.eq("empresa_tipo_segmento", f.segmento);
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

function winRate(rows: LinhaFechada[]): {
  taxa: number | null;
  vendidas: number;
  perdidas: number;
} {
  const vendidas = rows.filter((r) => r.status === "vendida").length;
  const perdidas = rows.filter((r) => r.status === "perdida").length;
  const total = vendidas + perdidas;
  return {
    taxa: total > 0 ? Math.round((vendidas / total) * 1000) / 10 : null,
    vendidas,
    perdidas,
  };
}

export async function carregarOpcoesDashboard(
  supabase: Client,
  isDiretor: boolean,
): Promise<OpcoesDashboard> {
  const [{ data: vendedores }, { data: etapas }, { data: ufsRaw }, { data: origens }] =
    await Promise.all([
      isDiretor
        ? supabase
            .from("usuarios")
            .select("id, nome")
            .eq("ativo", true)
            .order("nome")
        : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
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
    vendedores: vendedores ?? [],
    etapas: etapasLista,
    ufs,
    origens: (origens ?? []).map((o) => o.valor),
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
      filtrosEfetivos = { ...filtros, uf: null, segmento: null };
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
  ] = await Promise.all([
    aplicarFiltros(
      supabase
        .from("v_negociacoes")
        .select("status, valor_final, valor_estimado, fechado_em")
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
        data_faturamento: r.data_faturamento ?? null,
      }),
    );
  const fechadas = (fechadasRaw ?? []) as LinhaFechada[];
  const fechadasAnt = (fechadasAntRaw ?? []) as LinhaFechada[];
  const vendidasAno = (vendidasAnoRaw ?? []) as LinhaFechada[];

  // ---------- KPIs ----------
  const pipelineTotal = abertas.reduce((s, r) => s + num(r.valor_estimado), 0);
  const ponderadoDe = (rows: LinhaAberta[]) =>
    rows.reduce(
      (s, r) => s + num(r.valor_estimado) * pesoTemperatura(r.temperatura, pesos),
      0,
    );
  const pipelinePonderado = ponderadoDe(abertas);

  const wr = winRate(fechadas);
  const wrAnt = winRate(fechadasAnt);

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
    pipelinePonderado,
    winRate: wr.taxa,
    winRateAnterior: wrAnt.taxa,
    qtdVendidas: wr.vendidas,
    qtdPerdidas: wr.perdidas,
    forecastMes: ponderadoDe(doMes),
    forecastMesQtd: doMes.length,
    forecastMesSeguinte: ponderadoDe(doMesSeguinte),
    forecastMesSeguinteQtd: doMesSeguinte.length,
    forecastTrimestre: ponderadoDe(doTrimestre),
    forecastTrimestreQtd: doTrimestre.length,
    forecastTrimestreAnterior: ponderadoDe(doTrimestreAnterior),
    mesAtual,
    mesSeguinte,
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
      somarNoTrimestre(r.criado_em, num(r.valor_estimado));
    }
  } else {
    for (const r of abertas) {
      somarNoTrimestre(mesPrevisao(r, hoje), num(r.valor_estimado));
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
    et.valor += num(r.valor_estimado);
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
  const proximosFechamentos: NegociacaoResumo[] = abertas
    .filter((r) => {
      if (Number(r.temperatura) !== 3) return false;
      const mes = mesPrevisao(r, hoje);
      const fimMes = adicionarDiasISO(inicioProximoMesISO(mes), -1);
      return mes <= limite30 && fimMes >= hoje;
    })
    .sort(
      (a, b) =>
        mesPrevisao(a, hoje).localeCompare(mesPrevisao(b, hoje)) ||
        num(b.valor_estimado) - num(a.valor_estimado),
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
    .sort((a, b) => num(b.valor_estimado) - num(a.valor_estimado))
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
    valor: num(r.valor_estimado),
    previsaoMes: r.previsao_mes,
    dataFaturamento: r.data_faturamento,
    temperatura: Number(r.temperatura ?? 2),
  }));

  return {
    kpis,
    trimestres,
    funis,
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
    previsaoMes: r.previsao_mes ? mesPrevisao(r, hoje) : null,
  };
}
