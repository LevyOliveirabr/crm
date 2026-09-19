import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatarData,
  formatarMoedaCurta,
  hojeISO,
  inicioMesISO,
  inicioProximoMesISO,
  mesPorExtenso,
} from "@/lib/format";
import {
  deltaPct,
  proximosSeisMeses,
  rotuloMesCurto,
  type PeriodoResolvido,
} from "@/lib/relatorios/periodo";
import type {
  DadosPresidencia,
  DadosRelatorios,
  EmpresaParada,
  FiltrosRelatorio,
  LinhaFunil,
  LinhaPerda,
  LinhaPrevisao,
  LinhaRanking,
  NegociacaoParada,
  NegociacaoPerdaDetalhe,
  PresidenciaPerda,
  PresidenciaPrevisao,
  PresidenciaTop,
} from "@/lib/relatorios/tipos";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function aplicarFiltrosNeg<T extends { eq: (c: string, v: string) => T }>(
  query: T,
  filtros: FiltrosRelatorio,
): T {
  let q = query;
  if (filtros.vendedorId) q = q.eq("responsavel_id", filtros.vendedorId);
  if (filtros.linha) q = q.eq("linha", filtros.linha);
  if (filtros.origem) q = q.eq("origem", filtros.origem);
  return q;
}

function parsePresidenciaJson(
  raw: unknown,
  comentario: string,
): DadosPresidencia {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const previsaoRaw = Array.isArray(o.previsao) ? o.previsao : [];
  const topRaw = Array.isArray(o.top_negociacoes) ? o.top_negociacoes : [];
  const perdasRaw = Array.isArray(o.perdas) ? o.perdas : [];

  return {
    mes: String(o.mes ?? ""),
    vendido: num(o.vendido),
    qtd_vendida: num(o.qtd_vendida),
    ticket_medio: num(o.ticket_medio),
    vendido_mes_anterior: num(o.vendido_mes_anterior),
    variacao_pct:
      o.variacao_pct == null ? null : num(o.variacao_pct),
    perdido: num(o.perdido),
    qtd_perdida: num(o.qtd_perdida),
    conversao_pct:
      o.conversao_pct == null ? null : num(o.conversao_pct),
    previsao: previsaoRaw.map((p) => {
      const row = p as Record<string, unknown>;
      return {
        mes: String(row.mes ?? ""),
        aberto: num(row.aberto),
        realista: num(row.realista),
        otimista: num(row.otimista),
      } satisfies PresidenciaPrevisao;
    }),
    top_negociacoes: topRaw.map((t) => {
      const row = t as Record<string, unknown>;
      return {
        empresa_nome: String(row.empresa_nome ?? ""),
        titulo: String(row.titulo ?? ""),
        valor_estimado: num(row.valor_estimado),
        etapa_nome: String(row.etapa_nome ?? ""),
        proxima_acao_descricao:
          row.proxima_acao_descricao == null
            ? null
            : String(row.proxima_acao_descricao),
        proxima_acao_data:
          row.proxima_acao_data == null
            ? null
            : String(row.proxima_acao_data),
        responsavel_nome: String(row.responsavel_nome ?? ""),
      } satisfies PresidenciaTop;
    }),
    perdas: perdasRaw.map((p) => {
      const row = p as Record<string, unknown>;
      return {
        motivo_perda: String(row.motivo_perda ?? "Sem motivo"),
        qtd: num(row.qtd),
        valor: num(row.valor),
      } satisfies PresidenciaPerda;
    }),
    comentario,
  };
}

async function carregarPresidencia(
  supabase: Client,
  filtros: FiltrosRelatorio,
): Promise<DadosPresidencia | null> {
  // Função SQL é mensal; usa o primeiro mês do período.
  const mesRef = filtros.periodo.meses[0] ?? inicioMesISO(hojeISO());
  const chaveComentario = `comentario_${mesRef.slice(0, 7)}`;

  const temFiltroExtra = Boolean(
    filtros.vendedorId || filtros.linha || filtros.origem,
  );

  const [{ data: comentarioRow }, rpcResult] = await Promise.all([
    supabase.from("config").select("valor").eq("chave", chaveComentario).maybeSingle(),
    temFiltroExtra
      ? Promise.resolve({ data: null, error: null })
      : supabase.rpc("relatorio_presidencia", { p_mes: mesRef }),
  ]);

  if (!temFiltroExtra && rpcResult.data != null) {
    return parsePresidenciaJson(
      rpcResult.data,
      comentarioRow?.valor ?? "",
    );
  }

  // Com filtros: monta equivalente a partir das views/tabelas.
  const mesAnt = (() => {
    const [y, m] = mesRef.split("-").map(Number);
    const d = new Date(Date.UTC(y!, m! - 2, 1));
    return d.toISOString().slice(0, 10);
  })();

  let resQuery = supabase
    .from("negociacoes")
    .select("status, valor_final, valor_estimado, fechado_em, responsavel_id, linha, origem")
    .in("status", ["vendida", "perdida"])
    .is("arquivado_em", null)
    .gte("fechado_em", mesRef)
    .lt("fechado_em", inicioProximoMesISO(mesRef));
  resQuery = aplicarFiltrosNeg(resQuery, filtros);

  let resAntQuery = supabase
    .from("negociacoes")
    .select("status, valor_final, valor_estimado")
    .in("status", ["vendida", "perdida"])
    .is("arquivado_em", null)
    .gte("fechado_em", mesAnt)
    .lt("fechado_em", mesRef);
  resAntQuery = aplicarFiltrosNeg(resAntQuery, filtros);

  const pesosKeys = ["peso_fria", "peso_morna", "peso_quente"] as const;
  const [
    { data: fechadas },
    { data: fechadasAnt },
    { data: pesosRows },
    { data: abertas },
    { data: top },
  ] = await Promise.all([
    resQuery,
    resAntQuery,
    supabase.from("config").select("chave, valor").in("chave", [...pesosKeys]),
    (() => {
      let q = supabase
        .from("negociacoes")
        .select("valor_estimado, temperatura, previsao_mes, responsavel_id, linha, origem")
        .eq("status", "aberta")
        .is("arquivado_em", null);
      q = aplicarFiltrosNeg(q, filtros);
      return q;
    })(),
    (() => {
      let q = supabase
        .from("v_negociacoes")
        .select(
          "empresa_nome, titulo, valor_estimado, etapa_nome, proxima_acao_descricao, proxima_acao_data, responsavel_nome, responsavel_id, linha, origem",
        )
        .eq("status", "aberta")
        .order("valor_estimado", { ascending: false })
        .limit(40);
      if (filtros.vendedorId) q = q.eq("responsavel_id", filtros.vendedorId);
      if (filtros.linha) q = q.eq("linha", filtros.linha);
      if (filtros.origem) q = q.eq("origem", filtros.origem);
      return q;
    })(),
  ]);

  const pesos = { fria: 0.2, morna: 0.5, quente: 0.8 };
  for (const row of pesosRows ?? []) {
    if (row.chave === "peso_fria") pesos.fria = num(row.valor);
    if (row.chave === "peso_morna") pesos.morna = num(row.valor);
    if (row.chave === "peso_quente") pesos.quente = num(row.valor);
  }

  const vendido = (fechadas ?? [])
    .filter((n) => n.status === "vendida")
    .reduce((s, n) => s + num(n.valor_final), 0);
  const qtd_vendida = (fechadas ?? []).filter((n) => n.status === "vendida").length;
  const perdido = (fechadas ?? [])
    .filter((n) => n.status === "perdida")
    .reduce((s, n) => s + num(n.valor_estimado), 0);
  const qtd_perdida = (fechadas ?? []).filter((n) => n.status === "perdida").length;
  const vendido_mes_anterior = (fechadasAnt ?? [])
    .filter((n) => n.status === "vendida")
    .reduce((s, n) => s + num(n.valor_final), 0);

  const mesesPrev = [0, 1, 2].map((i) => {
    let m = mesRef;
    for (let k = 0; k < i; k++) m = inicioProximoMesISO(m);
    return m;
  });

  const previsao: PresidenciaPrevisao[] = mesesPrev.map((mes) => {
    const rows = (abertas ?? []).filter((n) => {
      const pm = n.previsao_mes
        ? inicioMesISO(String(n.previsao_mes))
        : inicioProximoMesISO(hojeISO());
      return pm === mes;
    });
    const aberto = rows.reduce((s, n) => s + num(n.valor_estimado), 0);
    const realista = rows.reduce((s, n) => {
      const t = Number(n.temperatura);
      const p = t === 1 ? pesos.fria : t === 2 ? pesos.morna : pesos.quente;
      return s + num(n.valor_estimado) * p;
    }, 0);
    const otimista = rows
      .filter((n) => Number(n.temperatura) >= 2)
      .reduce((s, n) => s + num(n.valor_estimado), 0);
    return { mes, aberto, realista, otimista };
  });

  const perdasMap = new Map<string, PresidenciaPerda>();
  // Need motivos — refetch with motivo
  const { data: perdasRows } = await (() => {
    let q = supabase
      .from("negociacoes")
      .select("motivo_perda, valor_estimado, responsavel_id, linha, origem")
      .eq("status", "perdida")
      .is("arquivado_em", null)
      .gte("fechado_em", mesRef)
      .lt("fechado_em", inicioProximoMesISO(mesRef));
    q = aplicarFiltrosNeg(q, filtros);
    return q;
  })();
  for (const row of perdasRows ?? []) {
    const motivo = row.motivo_perda ?? "Sem motivo";
    const cur = perdasMap.get(motivo) ?? { motivo_perda: motivo, qtd: 0, valor: 0 };
    cur.qtd += 1;
    cur.valor += num(row.valor_estimado);
    perdasMap.set(motivo, cur);
  }

  return {
    mes: mesRef,
    vendido,
    qtd_vendida,
    ticket_medio: qtd_vendida > 0 ? Math.round((vendido / qtd_vendida) * 100) / 100 : 0,
    vendido_mes_anterior,
    variacao_pct: deltaPct(vendido, vendido_mes_anterior),
    perdido,
    qtd_perdida,
    conversao_pct:
      qtd_vendida + qtd_perdida > 0
        ? Math.round((qtd_vendida / (qtd_vendida + qtd_perdida)) * 1000) / 10
        : null,
    previsao,
    top_negociacoes: (top ?? []).slice(0, 10).map((t) => ({
      empresa_nome: t.empresa_nome ?? "",
      titulo: t.titulo ?? "",
      valor_estimado: num(t.valor_estimado),
      etapa_nome: t.etapa_nome ?? "",
      proxima_acao_descricao: t.proxima_acao_descricao,
      proxima_acao_data: t.proxima_acao_data,
      responsavel_nome: t.responsavel_nome ?? "",
    })),
    perdas: [...perdasMap.values()],
    comentario: comentarioRow?.valor ?? "",
  };
}

type ConversaoEtapa = { passaram: number; diasTotal: number; n: number };

/**
 * Passagem e permanência por etapa, a partir de `etapa_historico`, para as
 * negociações criadas no período (coorte). Retorna vazio se a tabela ainda
 * não existir no banco (migration 0007).
 */
async function carregarConversaoFunil(
  supabase: Client,
  filtros: FiltrosRelatorio,
): Promise<Map<string, ConversaoEtapa>> {
  let q = supabase
    .from("etapa_historico")
    .select(
      "etapa_id, negociacao_id, entrou_em, saiu_em, negociacoes!inner(criado_em, responsavel_id, linha, origem, arquivado_em)",
    )
    .gte("negociacoes.criado_em", filtros.periodo.inicio)
    .lt("negociacoes.criado_em", filtros.periodo.fimExclusivo)
    .is("negociacoes.arquivado_em", null);
  if (filtros.vendedorId) q = q.eq("negociacoes.responsavel_id", filtros.vendedorId);
  if (filtros.linha) q = q.eq("negociacoes.linha", filtros.linha);
  if (filtros.origem) q = q.eq("negociacoes.origem", filtros.origem);

  const { data, error } = await q;
  const out = new Map<string, ConversaoEtapa>();
  if (error || !data) return out;

  const vistos = new Map<string, Set<string>>();
  const agora = Date.now();
  for (const h of data as unknown as {
    etapa_id: string;
    negociacao_id: string;
    entrou_em: string;
    saiu_em: string | null;
  }[]) {
    const cur = out.get(h.etapa_id) ?? { passaram: 0, diasTotal: 0, n: 0 };
    const set = vistos.get(h.etapa_id) ?? new Set<string>();
    if (!set.has(h.negociacao_id)) {
      set.add(h.negociacao_id);
      cur.passaram += 1;
    }
    vistos.set(h.etapa_id, set);
    const fim = h.saiu_em ? Date.parse(h.saiu_em) : agora;
    const ini = Date.parse(h.entrou_em);
    if (Number.isFinite(fim) && Number.isFinite(ini) && fim >= ini) {
      cur.diasTotal += (fim - ini) / 86_400_000;
      cur.n += 1;
    }
    out.set(h.etapa_id, cur);
  }
  return out;
}

function enriquecerConversao(
  linhas: Omit<LinhaFunil, "passaram" | "conversao_pct" | "dias_medios">[],
  conv: Map<string, ConversaoEtapa>,
): LinhaFunil[] {
  const ordenadas = [...linhas].sort(
    (a, b) => a.funil.localeCompare(b.funil, "pt-BR") || a.ordem - b.ordem,
  );
  return ordenadas.map((l, i) => {
    const c = conv.get(l.etapa_id);
    const passaram = c?.passaram ?? 0;
    const proxima = ordenadas[i + 1];
    const proximaMesmoFunil = proxima && proxima.funil_id === l.funil_id ? proxima : null;
    const passaramProx = proximaMesmoFunil ? (conv.get(proximaMesmoFunil.etapa_id)?.passaram ?? 0) : null;
    return {
      ...l,
      passaram,
      conversao_pct:
        proximaMesmoFunil && passaram > 0 && passaramProx != null
          ? Math.round(Math.min(100, (passaramProx / passaram) * 100) * 10) / 10
          : null,
      dias_medios: c && c.n > 0 ? Math.round((c.diasTotal / c.n) * 10) / 10 : null,
    };
  });
}

async function carregarFunil(
  supabase: Client,
  filtros: FiltrosRelatorio,
): Promise<LinhaFunil[]> {
  const [base, conv] = await Promise.all([
    carregarFunilBase(supabase, filtros),
    carregarConversaoFunil(supabase, filtros),
  ]);
  return enriquecerConversao(base, conv);
}

async function carregarFunilBase(
  supabase: Client,
  filtros: FiltrosRelatorio,
): Promise<Omit<LinhaFunil, "passaram" | "conversao_pct" | "dias_medios">[]> {
  // v_funil não tem linha/origem/vendedor — recalcula quando há filtro.
  if (!filtros.vendedorId && !filtros.linha && !filtros.origem) {
    const { data } = await supabase
      .from("v_funil")
      .select("funil_id, funil, etapa_id, etapa, ordem, qtd, valor")
      .order("ordem", { ascending: true });
    return (data ?? []).map((r) => ({
      funil_id: r.funil_id ?? "",
      funil: r.funil ?? "",
      etapa_id: r.etapa_id ?? "",
      etapa: r.etapa ?? "",
      ordem: num(r.ordem),
      qtd: num(r.qtd),
      valor: num(r.valor),
    }));
  }

  const [{ data: funis }, { data: etapas }, { data: negs }] = await Promise.all([
    supabase
      .from("funis")
      .select("id, nome")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
    supabase
      .from("etapas")
      .select("id, nome, ordem, funil_id")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
    (() => {
      let q = supabase
        .from("negociacoes")
        .select("etapa_id, valor_estimado, responsavel_id, linha, origem")
        .eq("status", "aberta")
        .is("arquivado_em", null);
      q = aplicarFiltrosNeg(q, filtros);
      return q;
    })(),
  ]);

  const funilNome = new Map((funis ?? []).map((f) => [f.id, f.nome]));
  const funilIds = new Set(funilNome.keys());

  const agg = new Map<string, { qtd: number; valor: number }>();
  for (const n of negs ?? []) {
    const cur = agg.get(n.etapa_id) ?? { qtd: 0, valor: 0 };
    cur.qtd += 1;
    cur.valor += num(n.valor_estimado);
    agg.set(n.etapa_id, cur);
  }

  return (etapas ?? [])
    .filter((et) => funilIds.has(et.funil_id))
    .map((et) => {
      const a = agg.get(et.id) ?? { qtd: 0, valor: 0 };
      return {
        funil_id: et.funil_id,
        funil: funilNome.get(et.funil_id) ?? "",
        etapa_id: et.id,
        etapa: et.nome,
        ordem: et.ordem,
        qtd: a.qtd,
        valor: a.valor,
      };
    });
}

async function carregarPrevisao(
  supabase: Client,
  filtros: FiltrosRelatorio,
): Promise<LinhaPrevisao[]> {
  const meses = proximosSeisMeses();
  const inicio = meses[0]!;
  const fim = inicioProximoMesISO(meses[meses.length - 1]!);

  const [{ data: pesosRows }, { data: negs }] = await Promise.all([
    supabase
      .from("config")
      .select("chave, valor")
      .in("chave", ["peso_fria", "peso_morna", "peso_quente"]),
    (() => {
      let q = supabase
        .from("negociacoes")
        .select(
          "valor_estimado, temperatura, previsao_mes, responsavel_id, linha, origem",
        )
        .eq("status", "aberta")
        .is("arquivado_em", null);
      q = aplicarFiltrosNeg(q, filtros);
      return q;
    })(),
  ]);

  const pesos = { fria: 0.2, morna: 0.5, quente: 0.8 };
  for (const row of pesosRows ?? []) {
    if (row.chave === "peso_fria") pesos.fria = num(row.valor);
    if (row.chave === "peso_morna") pesos.morna = num(row.valor);
    if (row.chave === "peso_quente") pesos.quente = num(row.valor);
  }

  // Também agregar via view quando sem filtros extras (validação cruzada).
  if (!filtros.vendedorId && !filtros.linha && !filtros.origem) {
    const { data: viewRows } = await supabase
      .from("v_previsao")
      .select("mes, aberto, realista, otimista, qtd")
      .gte("mes", inicio)
      .lt("mes", fim);

    const byMes = new Map<string, LinhaPrevisao>();
    for (const mes of meses) {
      byMes.set(mes, { mes, aberto: 0, realista: 0, otimista: 0, qtd: 0 });
    }
    for (const r of viewRows ?? []) {
      if (!r.mes) continue;
      const mes = inicioMesISO(r.mes);
      const cur = byMes.get(mes);
      if (!cur) continue;
      cur.aberto += num(r.aberto);
      cur.realista += num(r.realista);
      cur.otimista += num(r.otimista);
      cur.qtd += num(r.qtd);
    }
    return meses.map((m) => byMes.get(m)!);
  }

  const byMes = new Map<string, LinhaPrevisao>();
  for (const mes of meses) {
    byMes.set(mes, { mes, aberto: 0, realista: 0, otimista: 0, qtd: 0 });
  }
  const defaultMes = inicioProximoMesISO(hojeISO());
  for (const n of negs ?? []) {
    const mes = n.previsao_mes
      ? inicioMesISO(String(n.previsao_mes))
      : defaultMes;
    const cur = byMes.get(mes);
    if (!cur) continue;
    const valor = num(n.valor_estimado);
    const t = Number(n.temperatura);
    const p = t === 1 ? pesos.fria : t === 2 ? pesos.morna : pesos.quente;
    cur.aberto += valor;
    cur.realista += valor * p;
    if (t >= 2) cur.otimista += valor;
    cur.qtd += 1;
  }
  return meses.map((m) => byMes.get(m)!);
}

async function carregarRanking(
  supabase: Client,
  filtros: FiltrosRelatorio,
): Promise<LinhaRanking[]> {
  const { periodo } = filtros;
  const [{ data: usuarios }, { data: resultado }, { data: resultadoAnt }, { data: abertas }, { data: interacoes }, { data: interacoesAnt }, { data: metasRows }] =
    await Promise.all([
      supabase
        .from("usuarios")
        .select("id, nome, ativo")
        .order("nome"),
      supabase
        .from("v_resultado_mensal")
        .select("responsavel_id, vendido, qtd_vendida, qtd_perdida, mes")
        .in("mes", periodo.meses.length ? periodo.meses : ["1970-01-01"]),
      supabase
        .from("v_resultado_mensal")
        .select("responsavel_id, vendido, qtd_vendida, qtd_perdida, mes")
        .in(
          "mes",
          periodo.anterior.meses.length
            ? periodo.anterior.meses
            : ["1970-01-01"],
        ),
      (() => {
        let q = supabase
          .from("v_negociacoes")
          .select(
            "responsavel_id, valor_estimado, sem_acao, acao_atrasada, linha, origem",
          )
          .eq("status", "aberta");
        if (filtros.linha) q = q.eq("linha", filtros.linha);
        if (filtros.origem) q = q.eq("origem", filtros.origem);
        return q;
      })(),
      supabase
        .from("interacoes")
        .select("usuario_id, criado_em, tipo, negociacao_id")
        .neq("tipo", "sistema")
        .gte("criado_em", periodo.inicio)
        .lt("criado_em", periodo.fimExclusivo),
      supabase
        .from("interacoes")
        .select("usuario_id, criado_em, tipo, negociacao_id")
        .neq("tipo", "sistema")
        .gte("criado_em", periodo.anterior.inicio)
        .lt("criado_em", periodo.anterior.fimExclusivo),
      supabase
        .from("metas")
        .select("responsavel_id, valor, mes")
        .in("mes", periodo.meses.length ? periodo.meses : ["1970-01-01"]),
    ]);

  const metaPor = new Map<string, number>();
  for (const m of metasRows ?? []) {
    metaPor.set(m.responsavel_id, (metaPor.get(m.responsavel_id) ?? 0) + num(m.valor));
  }

  let interacoesFiltradas = interacoes ?? [];
  let interacoesAntFiltradas = interacoesAnt ?? [];
  if (filtros.linha || filtros.origem) {
    const { data: negsFiltro } = await (() => {
      let q = supabase
        .from("negociacoes")
        .select("id")
        .is("arquivado_em", null);
      if (filtros.linha) q = q.eq("linha", filtros.linha);
      if (filtros.origem) q = q.eq("origem", filtros.origem);
      return q;
    })();
    const ids = new Set((negsFiltro ?? []).map((n) => n.id));
    interacoesFiltradas = (interacoes ?? []).filter((i) =>
      ids.has(i.negociacao_id),
    );
    interacoesAntFiltradas = (interacoesAnt ?? []).filter((i) =>
      ids.has(i.negociacao_id),
    );
  }

  type Acc = {
    vendido: number;
    qtd: number;
    qtd_perdida: number;
    vendido_ant: number;
    qtd_ant: number;
    qtd_perdida_ant: number;
    aberto: number;
    aberto_ant: number;
    interacoes: number;
    interacoes_ant: number;
    abertas: number;
    com_acao: number;
    acoes_atrasadas: number;
  };

  const map = new Map<string, Acc>();
  const ensure = (id: string): Acc => {
    let a = map.get(id);
    if (!a) {
      a = {
        vendido: 0,
        qtd: 0,
        qtd_perdida: 0,
        vendido_ant: 0,
        qtd_ant: 0,
        qtd_perdida_ant: 0,
        aberto: 0,
        aberto_ant: 0,
        interacoes: 0,
        interacoes_ant: 0,
        abertas: 0,
        com_acao: 0,
        acoes_atrasadas: 0,
      };
      map.set(id, a);
    }
    return a;
  };

  for (const r of resultado ?? []) {
    if (!r.responsavel_id) continue;
    if (filtros.vendedorId && r.responsavel_id !== filtros.vendedorId) continue;
    const a = ensure(r.responsavel_id);
    a.vendido += num(r.vendido);
    a.qtd += num(r.qtd_vendida);
    a.qtd_perdida += num(r.qtd_perdida);
  }
  for (const r of resultadoAnt ?? []) {
    if (!r.responsavel_id) continue;
    if (filtros.vendedorId && r.responsavel_id !== filtros.vendedorId) continue;
    const a = ensure(r.responsavel_id);
    a.vendido_ant += num(r.vendido);
    a.qtd_ant += num(r.qtd_vendida);
    a.qtd_perdida_ant += num(r.qtd_perdida);
  }
  for (const n of abertas ?? []) {
    if (!n.responsavel_id) continue;
    if (filtros.vendedorId && n.responsavel_id !== filtros.vendedorId) continue;
    const a = ensure(n.responsavel_id);
    a.aberto += num(n.valor_estimado);
    a.abertas += 1;
    if (!n.sem_acao) a.com_acao += 1;
    if (n.acao_atrasada) a.acoes_atrasadas += 1;
  }
  for (const i of interacoesFiltradas) {
    if (!i.usuario_id) continue;
    if (filtros.vendedorId && i.usuario_id !== filtros.vendedorId) continue;
    ensure(i.usuario_id).interacoes += 1;
  }
  for (const i of interacoesAntFiltradas) {
    if (!i.usuario_id) continue;
    if (filtros.vendedorId && i.usuario_id !== filtros.vendedorId) continue;
    ensure(i.usuario_id).interacoes_ant += 1;
  }

  const linhas: LinhaRanking[] = (usuarios ?? [])
    .filter((u) => {
      if (filtros.vendedorId && u.id !== filtros.vendedorId) return false;
      const a = map.get(u.id);
      // Mostra ativos sempre; inativos só se tiverem movimento
      if (u.ativo) return true;
      return Boolean(
        a &&
          (a.vendido > 0 ||
            a.qtd > 0 ||
            a.aberto > 0 ||
            a.interacoes > 0 ||
            a.qtd_perdida > 0),
      );
    })
    .map((u) => {
      const a = map.get(u.id) ?? ensure(u.id);
      const totalFechadas = a.qtd + a.qtd_perdida;
      return {
        responsavel_id: u.id,
        nome: u.nome,
        ativo: u.ativo,
        vendido: a.vendido,
        qtd: a.qtd,
        aberto: a.aberto,
        conversao_pct:
          totalFechadas > 0
            ? Math.round((a.qtd / totalFechadas) * 1000) / 10
            : null,
        interacoes: a.interacoes,
        pct_com_acao:
          a.abertas > 0
            ? Math.round((a.com_acao / a.abertas) * 1000) / 10
            : null,
        acoes_atrasadas: a.acoes_atrasadas,
        meta: metaPor.get(u.id) ?? 0,
        atingimento_pct:
          (metaPor.get(u.id) ?? 0) > 0
            ? Math.round((a.vendido / (metaPor.get(u.id) ?? 1)) * 1000) / 10
            : null,
        vendido_ant: a.vendido_ant,
        qtd_ant: a.qtd_ant,
        aberto_ant: a.aberto_ant,
        interacoes_ant: a.interacoes_ant,
      };
    });

  return linhas.sort((a, b) => b.vendido - a.vendido);
}

async function carregarPerdas(
  supabase: Client,
  filtros: FiltrosRelatorio,
): Promise<{
  perdas: LinhaPerda[];
  detalhes: NegociacaoPerdaDetalhe[];
  totais: { valor: number; valorAnt: number; qtd: number; qtdAnt: number };
}> {
  const { periodo } = filtros;

  let atuaisQ = supabase
    .from("v_motivos_perda")
    .select("motivo_perda, qtd, valor, mes, linha, responsavel_id")
    .in("mes", periodo.meses.length ? periodo.meses : ["1970-01-01"]);
  let antQ = supabase
    .from("v_motivos_perda")
    .select("motivo_perda, qtd, valor, mes, linha, responsavel_id")
    .in(
      "mes",
      periodo.anterior.meses.length ? periodo.anterior.meses : ["1970-01-01"],
    );

  if (filtros.vendedorId) {
    atuaisQ = atuaisQ.eq("responsavel_id", filtros.vendedorId);
    antQ = antQ.eq("responsavel_id", filtros.vendedorId);
  }
  if (filtros.linha) {
    atuaisQ = atuaisQ.eq("linha", filtros.linha);
    antQ = antQ.eq("linha", filtros.linha);
  }

  let detalheQ = supabase
    .from("v_negociacoes")
    .select(
      "id, titulo, empresa_nome, valor_estimado, motivo_perda, anotacao_fechamento, responsavel_nome, fechado_em, linha, origem, responsavel_id",
    )
    .eq("status", "perdida")
    .gte("fechado_em", periodo.inicio)
    .lt("fechado_em", periodo.fimExclusivo)
    .order("fechado_em", { ascending: false });
  if (filtros.vendedorId) detalheQ = detalheQ.eq("responsavel_id", filtros.vendedorId);
  if (filtros.linha) detalheQ = detalheQ.eq("linha", filtros.linha);
  if (filtros.origem) detalheQ = detalheQ.eq("origem", filtros.origem);

  const [{ data: atuais }, { data: anteriores }, { data: detalhesRaw }] =
    await Promise.all([atuaisQ, antQ, detalheQ]);

  // origem não está em v_motivos_perda — se filtrar origem, usa só detalhes
  const mapAtual = new Map<string, { qtd: number; valor: number }>();
  const mapAnt = new Map<string, { qtd: number; valor: number }>();

  if (filtros.origem) {
    for (const d of detalhesRaw ?? []) {
      const motivo = d.motivo_perda ?? "Sem motivo";
      const cur = mapAtual.get(motivo) ?? { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += num(d.valor_estimado);
      mapAtual.set(motivo, cur);
    }
  } else {
    for (const r of atuais ?? []) {
      const motivo = r.motivo_perda ?? "Sem motivo";
      const cur = mapAtual.get(motivo) ?? { qtd: 0, valor: 0 };
      cur.qtd += num(r.qtd);
      cur.valor += num(r.valor);
      mapAtual.set(motivo, cur);
    }
    for (const r of anteriores ?? []) {
      const motivo = r.motivo_perda ?? "Sem motivo";
      const cur = mapAnt.get(motivo) ?? { qtd: 0, valor: 0 };
      cur.qtd += num(r.qtd);
      cur.valor += num(r.valor);
      mapAnt.set(motivo, cur);
    }
  }

  const totalValor = [...mapAtual.values()].reduce((s, v) => s + v.valor, 0);
  const totalQtd = [...mapAtual.values()].reduce((s, v) => s + v.qtd, 0);
  const totalValorAnt = [...mapAnt.values()].reduce((s, v) => s + v.valor, 0);
  const totalQtdAnt = [...mapAnt.values()].reduce((s, v) => s + v.qtd, 0);

  const motivos = new Set([...mapAtual.keys(), ...mapAnt.keys()]);
  const perdas: LinhaPerda[] = [...motivos]
    .map((motivo) => {
      const a = mapAtual.get(motivo) ?? { qtd: 0, valor: 0 };
      const b = mapAnt.get(motivo) ?? { qtd: 0, valor: 0 };
      return {
        motivo,
        qtd: a.qtd,
        valor: a.valor,
        pct: totalValor > 0 ? Math.round((a.valor / totalValor) * 1000) / 10 : 0,
        qtd_ant: b.qtd,
        valor_ant: b.valor,
      };
    })
    .filter((p) => p.qtd > 0 || p.qtd_ant > 0)
    .sort((a, b) => b.valor - a.valor);

  const detalhes: NegociacaoPerdaDetalhe[] = (detalhesRaw ?? []).map((d) => ({
    id: d.id!,
    titulo: d.titulo ?? "",
    empresa_nome: d.empresa_nome ?? "",
    valor_estimado: num(d.valor_estimado),
    motivo_perda: d.motivo_perda ?? "Sem motivo",
    anotacao_fechamento: d.anotacao_fechamento,
    responsavel_nome: d.responsavel_nome ?? "",
    fechado_em: d.fechado_em,
    linha: d.linha,
  }));

  return {
    perdas,
    detalhes,
    totais: {
      valor: totalValor,
      valorAnt: totalValorAnt,
      qtd: totalQtd,
      qtdAnt: totalQtdAnt,
    },
  };
}

async function carregarCarteira(
  supabase: Client,
  filtros: FiltrosRelatorio,
): Promise<{
  negociacoes: NegociacaoParada[];
  empresas: EmpresaParada[];
}> {
  const { data: cfg } = await supabase
    .from("config")
    .select("chave, valor")
    .in("chave", ["dias_parada_negociacao", "dias_parada_empresa"]);
  const diasEmpresa = Math.max(
    1,
    Number.parseInt(
      cfg?.find((c) => c.chave === "dias_parada_empresa")?.valor ?? "60",
      10,
    ) || 60,
  );

  let negQ = supabase
    .from("v_negociacoes")
    .select(
      "id, titulo, empresa_nome, empresa_id, valor_estimado, responsavel_nome, responsavel_id, dias_sem_interacao, parada, linha, origem, ultima_interacao",
    )
    .eq("status", "aberta")
    .eq("parada", true)
    .order("valor_estimado", { ascending: false });
  if (filtros.vendedorId) negQ = negQ.eq("responsavel_id", filtros.vendedorId);
  if (filtros.linha) negQ = negQ.eq("linha", filtros.linha);
  if (filtros.origem) negQ = negQ.eq("origem", filtros.origem);

  let todasQ = supabase
    .from("v_negociacoes")
    .select(
      "empresa_id, empresa_nome, responsavel_nome, responsavel_id, dias_sem_interacao, ultima_interacao, linha, origem",
    )
    .eq("status", "aberta");
  if (filtros.vendedorId) todasQ = todasQ.eq("responsavel_id", filtros.vendedorId);
  if (filtros.linha) todasQ = todasQ.eq("linha", filtros.linha);
  if (filtros.origem) todasQ = todasQ.eq("origem", filtros.origem);

  const [{ data: paradas }, { data: abertas }] = await Promise.all([negQ, todasQ]);

  const negociacoes: NegociacaoParada[] = (paradas ?? []).map((n) => ({
    id: n.id!,
    titulo: n.titulo ?? "",
    empresa_nome: n.empresa_nome ?? "",
    valor_estimado: num(n.valor_estimado),
    responsavel_nome: n.responsavel_nome ?? "",
    dias_sem_interacao: num(n.dias_sem_interacao),
  }));

  // Empresas: agrega pela maior dias_sem_interacao (pior contato) entre negociações abertas
  const empMap = new Map<
    string,
    { nome: string; dias: number; responsavel: string | null }
  >();
  for (const n of abertas ?? []) {
    if (!n.empresa_id) continue;
    const dias = num(n.dias_sem_interacao);
    const cur = empMap.get(n.empresa_id);
    if (!cur || dias > cur.dias) {
      empMap.set(n.empresa_id, {
        nome: n.empresa_nome ?? "",
        dias,
        responsavel: n.responsavel_nome,
      });
    }
  }
  const empresas: EmpresaParada[] = [...empMap.entries()]
    .filter(([, v]) => v.dias >= diasEmpresa)
    .map(([empresa_id, v]) => ({
      empresa_id,
      empresa_nome: v.nome,
      dias_sem_contato: v.dias,
      responsavel_nome: v.responsavel,
    }))
    .sort((a, b) => b.dias_sem_contato - a.dias_sem_contato);

  return { negociacoes, empresas };
}

export async function carregarDadosRelatorios(
  supabase: Client,
  filtros: FiltrosRelatorio,
): Promise<DadosRelatorios> {
  const [presidencia, funil, previsao, ranking, perdasPack, carteira] =
    await Promise.all([
      carregarPresidencia(supabase, filtros),
      carregarFunil(supabase, filtros),
      carregarPrevisao(supabase, filtros),
      filtros.isDiretor
        ? carregarRanking(supabase, filtros)
        : Promise.resolve([] as LinhaRanking[]),
      carregarPerdas(supabase, filtros),
      carregarCarteira(supabase, filtros),
    ]);

  const funilValor = funil.reduce((s, f) => s + f.valor, 0);
  const funilQtd = funil.reduce((s, f) => s + f.qtd, 0);
  const carteiraValor = carteira.negociacoes.reduce(
    (s, n) => s + n.valor_estimado,
    0,
  );

  return {
    presidencia,
    funil,
    previsao,
    ranking,
    perdas: perdasPack.perdas,
    perdasDetalhe: perdasPack.detalhes,
    carteiraParada: carteira.negociacoes,
    empresasParadas: carteira.empresas,
    totais: {
      perdasValor: perdasPack.totais.valor,
      perdasValorAnt: perdasPack.totais.valorAnt,
      perdasQtd: perdasPack.totais.qtd,
      perdasQtdAnt: perdasPack.totais.qtdAnt,
      carteiraValor,
      carteiraQtd: carteira.negociacoes.length,
      funilValor,
      funilQtd,
    },
  };
}

export function textoWhatsAppPresidencia(
  dados: DadosPresidencia,
  ate: string = hojeISO(),
): string {
  const mesNome = mesPorExtenso(dados.mes);
  const mesTitulo = mesNome
    ? mesNome.charAt(0).toUpperCase() + mesNome.slice(1).replace(" de ", "/")
    : dados.mes;
  // "setembro de 2026" → "Setembro/2026"
  const partes = mesNome.split(" de ");
  const tituloMes =
    partes.length === 2
      ? `${partes[0]!.charAt(0).toUpperCase()}${partes[0]!.slice(1)}/${partes[1]}`
      : mesTitulo;

  const varTxt =
    dados.variacao_pct == null
      ? ""
      : ` (${dados.variacao_pct > 0 ? "+" : ""}${dados.variacao_pct}% vs. mês anterior)`;

  const linhasPrev = (dados.previsao ?? []).map((p, idx) => {
    const rotulo = rotuloMesCurto(inicioMesISO(p.mes));
    const prefix = idx === 0 ? `${rotulo} (restante)` : rotulo;
    return `${prefix}: ${formatarMoedaCurta(p.realista)} realista / ${formatarMoedaCurta(p.otimista)} otimista`;
  });

  const tops = (dados.top_negociacoes ?? [])
    .slice(0, 5)
    .map((t) => {
      const acao = t.proxima_acao_descricao
        ? ` – ${t.proxima_acao_descricao}${t.proxima_acao_data ? ` ${formatarData(t.proxima_acao_data)}` : ""}`
        : "";
      return `• ${t.empresa_nome} – ${formatarMoedaCurta(t.valor_estimado)} – ${t.etapa_nome}${acao}`;
    });

  const perdas = (dados.perdas ?? [])
    .map((p) => `${p.motivo_perda} (${p.qtd})`)
    .join(", ");

  return [
    `*F-Led · Vendas e previsão*`,
    `${tituloMes} · até ${formatarData(ate)}`,
    ``,
    `*Resultado do mês*`,
    `Vendido: ${formatarMoedaCurta(dados.vendido)}${varTxt} · ${dados.qtd_vendida} negócios · ticket ${formatarMoedaCurta(dados.ticket_medio)}`,
    `Perdido: ${formatarMoedaCurta(dados.perdido)} (${dados.qtd_perdida}) · Conversão: ${dados.conversao_pct ?? "—"}%`,
    ``,
    `*Previsão de fechamento*`,
    ...linhasPrev,
    ``,
    `*Maiores negociações em andamento*`,
    ...(tops.length ? tops : ["—"]),
    ``,
    `*Perdas do mês*`,
    perdas || "—",
    ``,
    `*Comentário*`,
    dados.comentario || "—",
  ].join("\n");
}

export type { PeriodoResolvido };
