import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { ColunaExcel } from "@/lib/excel";
import { hojeISO, inicioMesISO, mesPorExtenso } from "@/lib/format";

type Sb = SupabaseClient<Database>;
type Filtros = Record<string, string | undefined>;

export type RegistroExportacao = {
  id: string;
  titulo: string;
  colunas: ColunaExcel[];
  query: (
    filtros: Filtros,
    supabase: Sb,
  ) => Promise<{
    linhas: Record<string, unknown>[];
    filtrosLabel: Record<string, string>;
  }>;
};

const PAGE = 1000;

/** Busca todas as páginas (Supabase limita a 1000 por request). */
async function fetchAll<T>(
  run: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function pick(filtros: Filtros, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = filtros[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

function mesFiltro(filtros: Filtros): string {
  const mes = pick(filtros, "mes", "periodo", "inicio");
  if (mes && /^\d{4}-\d{2}/.test(mes)) {
    return `${mes.slice(0, 7)}-01`;
  }
  return inicioMesISO(hojeISO());
}

function labelVendedor(v?: string): string {
  return v ? v : "Todos";
}

// ---------- registros ----------

const funilLista: RegistroExportacao = {
  id: "funil-lista",
  titulo: "Funil — lista",
  colunas: [
    { chave: "titulo", titulo: "Título", tipo: "texto" },
    { chave: "empresa_nome", titulo: "Empresa", tipo: "texto" },
    { chave: "etapa_nome", titulo: "Etapa", tipo: "texto" },
    { chave: "valor_estimado", titulo: "Valor", tipo: "moeda" },
    { chave: "temperatura", titulo: "Temp.", tipo: "inteiro" },
    { chave: "dias_na_etapa", titulo: "Dias", tipo: "inteiro" },
    { chave: "proxima_acao_descricao", titulo: "Próxima ação", tipo: "texto" },
    { chave: "proxima_acao_data", titulo: "Data ação", tipo: "data" },
    { chave: "responsavel_nome", titulo: "Responsável", tipo: "texto" },
    { chave: "linha", titulo: "Linha", tipo: "texto" },
  ],
  async query(filtros, supabase) {
    const funil = pick(filtros, "funil");
    const vendedor = pick(filtros, "vendedor");
    const linha = pick(filtros, "linha");
    const temperatura = pick(filtros, "temperatura");
    const q = (pick(filtros, "q") ?? "").toLowerCase();

    let funilId = funil;
    if (!funilId) {
      const { data } = await supabase
        .from("funis")
        .select("id")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();
      funilId = data?.id;
    }

    const rows = await fetchAll((from, to) => {
      let query = supabase
        .from("v_negociacoes")
        .select(
          "titulo, empresa_nome, etapa_nome, valor_estimado, temperatura, dias_na_etapa, proxima_acao_descricao, proxima_acao_data, responsavel_nome, linha, status, funil_id, responsavel_id",
        )
        .eq("status", "aberta")
        .order("atualizado_em", { ascending: false })
        .range(from, to);
      if (funilId) query = query.eq("funil_id", funilId);
      if (vendedor) query = query.eq("responsavel_id", vendedor);
      if (linha) query = query.eq("linha", linha);
      if (temperatura === "1" || temperatura === "2" || temperatura === "3") {
        query = query.eq("temperatura", Number(temperatura));
      }
      return query;
    });

    const filtradas = q
      ? rows.filter(
          (r) =>
            (r.titulo ?? "").toLowerCase().includes(q) ||
            (r.empresa_nome ?? "").toLowerCase().includes(q),
        )
      : rows;

    return {
      linhas: filtradas.map((r) => ({
        titulo: r.titulo,
        empresa_nome: r.empresa_nome,
        etapa_nome: r.etapa_nome,
        valor_estimado: Number(r.valor_estimado ?? 0),
        temperatura: Number(r.temperatura ?? 0),
        dias_na_etapa: Number(r.dias_na_etapa ?? 0),
        proxima_acao_descricao: r.proxima_acao_descricao,
        proxima_acao_data: r.proxima_acao_data,
        responsavel_nome: r.responsavel_nome,
        linha: r.linha,
      })),
      filtrosLabel: {
        Funil: funilId ?? "—",
        Vendedor: labelVendedor(vendedor),
        Linha: linha ?? "Todas",
        Temperatura: temperatura ?? "Todas",
        Busca: q || "—",
      },
    };
  },
};

const empresas: RegistroExportacao = {
  id: "empresas",
  titulo: "Empresas",
  colunas: [
    { chave: "nome", titulo: "Nome", tipo: "texto" },
    { chave: "cidade", titulo: "Cidade", tipo: "texto" },
    { chave: "uf", titulo: "UF", tipo: "texto" },
    { chave: "segmento", titulo: "Segmento", tipo: "texto" },
    { chave: "responsavel_nome", titulo: "Responsável", tipo: "texto" },
    { chave: "negociacoes_abertas", titulo: "Neg. abertas", tipo: "inteiro" },
    { chave: "valor_aberto", titulo: "Valor aberto", tipo: "moeda" },
    { chave: "ultimo_contato", titulo: "Último contato", tipo: "data" },
  ],
  async query(filtros, supabase) {
    const q = pick(filtros, "q");
    const vendedor = pick(filtros, "vendedor");

    const empresasRows = await fetchAll((from, to) => {
      let query = supabase
        .from("empresas")
        .select(
          "id, nome, cidade, uf, segmento, responsavel_id, usuarios(nome)",
        )
        .is("arquivado_em", null)
        .order("nome", { ascending: true })
        .range(from, to);
      if (q) query = query.ilike("nome", `%${q}%`);
      if (vendedor) query = query.eq("responsavel_id", vendedor);
      return query;
    });

    const neg = await fetchAll((from, to) =>
      supabase
        .from("v_negociacoes")
        .select("empresa_id, valor_estimado, ultima_interacao, status")
        .eq("status", "aberta")
        .range(from, to),
    );

    type Agg = {
      qtd: number;
      valor: number;
      ultimo: string | null;
    };
    const byEmpresa = new Map<string, Agg>();
    for (const n of neg) {
      if (!n.empresa_id) continue;
      const cur = byEmpresa.get(n.empresa_id) ?? {
        qtd: 0,
        valor: 0,
        ultimo: null as string | null,
      };
      cur.qtd += 1;
      cur.valor += Number(n.valor_estimado ?? 0);
      if (
        n.ultima_interacao &&
        (!cur.ultimo || n.ultima_interacao > cur.ultimo)
      ) {
        cur.ultimo = n.ultima_interacao;
      }
      byEmpresa.set(n.empresa_id, cur);
    }

    const linhas = empresasRows.map((e) => {
      const u = e.usuarios as { nome: string } | { nome: string }[] | null;
      const responsavelNome = Array.isArray(u)
        ? (u[0]?.nome ?? null)
        : (u?.nome ?? null);
      const agg = byEmpresa.get(e.id);
      return {
        nome: e.nome,
        cidade: e.cidade,
        uf: e.uf,
        segmento: e.segmento,
        responsavel_nome: responsavelNome,
        negociacoes_abertas: agg?.qtd ?? 0,
        valor_aberto: agg?.valor ?? 0,
        ultimo_contato: agg?.ultimo ?? null,
      };
    });

    linhas.sort((a, b) => {
      const ad = a.ultimo_contato ?? "";
      const bd = b.ultimo_contato ?? "";
      if (ad === bd) return String(a.nome).localeCompare(String(b.nome), "pt-BR");
      if (!ad) return -1;
      if (!bd) return 1;
      return ad < bd ? -1 : 1;
    });

    return {
      linhas,
      filtrosLabel: {
        Busca: q ?? "—",
        Vendedor: labelVendedor(vendedor),
      },
    };
  },
};

const contatos: RegistroExportacao = {
  id: "contatos",
  titulo: "Contatos",
  colunas: [
    { chave: "nome", titulo: "Nome", tipo: "texto" },
    { chave: "empresa_nome", titulo: "Empresa", tipo: "texto" },
    { chave: "cargo", titulo: "Cargo", tipo: "texto" },
    { chave: "whatsapp", titulo: "WhatsApp", tipo: "texto" },
    { chave: "email", titulo: "E-mail", tipo: "texto" },
    { chave: "decisor", titulo: "Decisor", tipo: "texto" },
  ],
  async query(filtros, supabase) {
    const q = (pick(filtros, "q") ?? "").toLowerCase();

    const rows = await fetchAll((from, to) =>
      supabase
        .from("contatos")
        .select("nome, cargo, whatsapp, email, decisor, empresas(nome)")
        .is("arquivado_em", null)
        .order("nome", { ascending: true })
        .range(from, to),
    );

    const mapped = rows.map((c) => {
      const emp = c.empresas as { nome: string } | { nome: string }[] | null;
      const empresaNome = Array.isArray(emp)
        ? (emp[0]?.nome ?? "—")
        : (emp?.nome ?? "—");
      return {
        nome: c.nome,
        empresa_nome: empresaNome,
        cargo: c.cargo,
        whatsapp: c.whatsapp,
        email: c.email,
        decisor: c.decisor ? "Sim" : "Não",
      };
    });

    const filtrados = q
      ? mapped.filter(
          (r) =>
            String(r.nome).toLowerCase().includes(q) ||
            String(r.empresa_nome).toLowerCase().includes(q),
        )
      : mapped;

    return {
      linhas: filtrados,
      filtrosLabel: { Busca: q || "—" },
    };
  },
};

const acoes: RegistroExportacao = {
  id: "acoes",
  titulo: "Tarefas / Hoje",
  colunas: [
    { chave: "descricao", titulo: "Descrição", tipo: "texto" },
    { chave: "empresa_nome", titulo: "Empresa", tipo: "texto" },
    { chave: "tipo", titulo: "Tipo", tipo: "texto" },
    { chave: "data", titulo: "Data", tipo: "data" },
    { chave: "situacao", titulo: "Situação", tipo: "texto" },
    { chave: "negociacao_titulo", titulo: "Negociação", tipo: "texto" },
  ],
  async query(filtros, supabase) {
    const vendedor = pick(filtros, "vendedor");
    const hoje = hojeISO();

    const rows = await fetchAll((from, to) => {
      let query = supabase
        .from("acoes")
        .select(
          `
          descricao,
          tipo,
          data,
          negociacoes!inner (
            titulo,
            status,
            arquivado_em,
            responsavel_id,
            empresas ( nome )
          )
        `,
        )
        .is("concluida_em", null)
        .lte("data", hoje)
        .eq("negociacoes.status", "aberta")
        .is("negociacoes.arquivado_em", null)
        .order("data", { ascending: true })
        .range(from, to);
      if (vendedor) {
        query = query.eq("negociacoes.responsavel_id", vendedor);
      }
      return query;
    });

    type Join = {
      descricao: string;
      tipo: string;
      data: string;
      negociacoes:
        | {
            titulo: string;
            empresas: { nome: string } | { nome: string }[] | null;
          }
        | {
            titulo: string;
            empresas: { nome: string } | { nome: string }[] | null;
          }[]
        | null;
    };

    const linhas = (rows as unknown as Join[]).map((a) => {
      const neg = Array.isArray(a.negociacoes)
        ? a.negociacoes[0]
        : a.negociacoes;
      const emp = neg?.empresas;
      const empresaNome = Array.isArray(emp)
        ? (emp[0]?.nome ?? "—")
        : (emp?.nome ?? "—");
      return {
        descricao: a.descricao,
        empresa_nome: empresaNome,
        tipo: a.tipo,
        data: a.data,
        situacao: a.data < hoje ? "Atrasada" : "Hoje",
        negociacao_titulo: neg?.titulo ?? "—",
      };
    });

    return {
      linhas,
      filtrosLabel: {
        Vendedor: labelVendedor(vendedor),
        Até: hoje,
      },
    };
  },
};

const relatorioPresidenciaTop: RegistroExportacao = {
  id: "relatorio-presidencia-top",
  titulo: "Relatório — Presidência (top 10)",
  colunas: [
    { chave: "empresa_nome", titulo: "Empresa", tipo: "texto" },
    { chave: "titulo", titulo: "Negociação", tipo: "texto" },
    { chave: "valor_estimado", titulo: "Valor", tipo: "moeda" },
    { chave: "etapa_nome", titulo: "Etapa", tipo: "texto" },
    { chave: "proxima_acao_descricao", titulo: "Próxima ação", tipo: "texto" },
    { chave: "proxima_acao_data", titulo: "Data ação", tipo: "data" },
    { chave: "responsavel_nome", titulo: "Responsável", tipo: "texto" },
  ],
  async query(filtros, supabase) {
    const mes = mesFiltro(filtros);
    const { data, error } = await supabase.rpc("relatorio_presidencia", {
      p_mes: mes,
    });
    if (error) throw new Error(error.message);

    const payload = (data ?? {}) as {
      top_negociacoes?: Record<string, unknown>[] | null;
    };
    const top = payload.top_negociacoes ?? [];

    return {
      linhas: top.map((t) => ({
        empresa_nome: t.empresa_nome,
        titulo: t.titulo,
        valor_estimado: Number(t.valor_estimado ?? 0),
        etapa_nome: t.etapa_nome,
        proxima_acao_descricao: t.proxima_acao_descricao,
        proxima_acao_data: t.proxima_acao_data,
        responsavel_nome: t.responsavel_nome,
      })),
      filtrosLabel: {
        Mês: mesPorExtenso(mes),
      },
    };
  },
};

const previsao: RegistroExportacao = {
  id: "previsao",
  titulo: "Relatório — Previsão",
  colunas: [
    { chave: "mes", titulo: "Mês", tipo: "data" },
    { chave: "aberto", titulo: "Aberto", tipo: "moeda" },
    { chave: "realista", titulo: "Realista", tipo: "moeda" },
    { chave: "otimista", titulo: "Otimista", tipo: "moeda" },
    { chave: "qtd", titulo: "Qtd", tipo: "inteiro" },
  ],
  async query(filtros, supabase) {
    const vendedor = pick(filtros, "vendedor");
    const mesInicio = mesFiltro(filtros);

    const rows = await fetchAll((from, to) => {
      let query = supabase
        .from("v_previsao")
        .select("mes, responsavel_id, aberto, realista, otimista, qtd")
        .gte("mes", mesInicio)
        .order("mes", { ascending: true })
        .range(from, to);
      if (vendedor) query = query.eq("responsavel_id", vendedor);
      return query;
    });

    // agrega por mês (vários responsáveis)
    const byMes = new Map<
      string,
      { aberto: number; realista: number; otimista: number; qtd: number }
    >();
    for (const r of rows) {
      if (!r.mes) continue;
      const cur = byMes.get(r.mes) ?? {
        aberto: 0,
        realista: 0,
        otimista: 0,
        qtd: 0,
      };
      cur.aberto += Number(r.aberto ?? 0);
      cur.realista += Number(r.realista ?? 0);
      cur.otimista += Number(r.otimista ?? 0);
      cur.qtd += Number(r.qtd ?? 0);
      byMes.set(r.mes, cur);
    }

    const linhas = [...byMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 6)
      .map(([mes, v]) => ({
        mes,
        aberto: v.aberto,
        realista: v.realista,
        otimista: v.otimista,
        qtd: v.qtd,
      }));

    return {
      linhas,
      filtrosLabel: {
        "A partir de": mesPorExtenso(mesInicio),
        Vendedor: labelVendedor(vendedor),
      },
    };
  },
};

const ranking: RegistroExportacao = {
  id: "ranking",
  titulo: "Relatório — Ranking",
  colunas: [
    { chave: "vendedor", titulo: "Vendedor", tipo: "texto" },
    { chave: "vendido", titulo: "Vendido", tipo: "moeda" },
    { chave: "qtd", titulo: "Qtd", tipo: "inteiro" },
    { chave: "aberto", titulo: "Aberto", tipo: "moeda" },
    { chave: "conversao_pct", titulo: "Conversão", tipo: "percentual" },
    { chave: "interacoes", titulo: "Interações", tipo: "inteiro" },
    { chave: "pct_com_acao", titulo: "% com ação", tipo: "percentual" },
    { chave: "acoes_atrasadas", titulo: "Ações atrasadas", tipo: "inteiro" },
  ],
  async query(filtros, supabase) {
    const mes = mesFiltro(filtros);
    const linha = pick(filtros, "linha");
    const origem = pick(filtros, "origem");
    const vendedor = pick(filtros, "vendedor");

    const [{ data: usuarios }, resultado, abertas, interacoes, acoesAtrasadas] =
      await Promise.all([
        supabase
          .from("usuarios")
          .select("id, nome")
          .eq("ativo", true)
          .order("nome"),
        fetchAll((from, to) => {
          let query = supabase
            .from("v_resultado_mensal")
            .select(
              "responsavel_id, vendido, qtd_vendida, perdido, qtd_perdida",
            )
            .eq("mes", mes)
            .range(from, to);
          if (vendedor) query = query.eq("responsavel_id", vendedor);
          return query;
        }),
        fetchAll((from, to) => {
          let query = supabase
            .from("v_negociacoes")
            .select("id, responsavel_id, valor_estimado, sem_acao, linha, origem")
            .eq("status", "aberta")
            .range(from, to);
          if (vendedor) query = query.eq("responsavel_id", vendedor);
          if (linha) query = query.eq("linha", linha);
          if (origem) query = query.eq("origem", origem);
          return query;
        }),
        fetchAll((from, to) => {
          const fim = new Date(`${mes}T00:00:00-03:00`);
          fim.setMonth(fim.getMonth() + 1);
          const fimIso = fim.toISOString().slice(0, 10);
          return supabase
            .from("interacoes")
            .select("id, usuario_id, criado_em")
            .gte("criado_em", `${mes}T00:00:00-03:00`)
            .lt("criado_em", `${fimIso}T00:00:00-03:00`)
            .neq("tipo", "sistema")
            .range(from, to);
        }),
        fetchAll((from, to) =>
          supabase
            .from("acoes")
            .select(
              "id, negociacoes!inner(responsavel_id, status, arquivado_em)",
            )
            .is("concluida_em", null)
            .lt("data", hojeISO())
            .eq("negociacoes.status", "aberta")
            .is("negociacoes.arquivado_em", null)
            .range(from, to),
        ),
      ]);

    type Acc = {
      vendido: number;
      qtd: number;
      perdidoQtd: number;
      aberto: number;
      interacoes: number;
      abertas: number;
      comAcao: number;
      atrasadas: number;
    };
    const byUser = new Map<string, Acc>();
    function acc(id: string): Acc {
      let a = byUser.get(id);
      if (!a) {
        a = {
          vendido: 0,
          qtd: 0,
          perdidoQtd: 0,
          aberto: 0,
          interacoes: 0,
          abertas: 0,
          comAcao: 0,
          atrasadas: 0,
        };
        byUser.set(id, a);
      }
      return a;
    }

    for (const r of resultado) {
      if (!r.responsavel_id) continue;
      const a = acc(r.responsavel_id);
      a.vendido += Number(r.vendido ?? 0);
      a.qtd += Number(r.qtd_vendida ?? 0);
      a.perdidoQtd += Number(r.qtd_perdida ?? 0);
    }
    for (const n of abertas) {
      if (!n.responsavel_id) continue;
      const a = acc(n.responsavel_id);
      a.aberto += Number(n.valor_estimado ?? 0);
      a.abertas += 1;
      if (!n.sem_acao) a.comAcao += 1;
    }
    for (const i of interacoes) {
      if (!i.usuario_id) continue;
      if (vendedor && i.usuario_id !== vendedor) continue;
      acc(i.usuario_id).interacoes += 1;
    }
    for (const a of acoesAtrasadas as unknown as {
      negociacoes:
        | { responsavel_id: string }
        | { responsavel_id: string }[]
        | null;
    }[]) {
      const neg = Array.isArray(a.negociacoes)
        ? a.negociacoes[0]
        : a.negociacoes;
      if (!neg?.responsavel_id) continue;
      if (vendedor && neg.responsavel_id !== vendedor) continue;
      acc(neg.responsavel_id).atrasadas += 1;
    }

    const linhas = (usuarios ?? [])
      .filter((u) => !vendedor || u.id === vendedor)
      .map((u) => {
        const a = byUser.get(u.id) ?? {
          vendido: 0,
          qtd: 0,
          perdidoQtd: 0,
          aberto: 0,
          interacoes: 0,
          abertas: 0,
          comAcao: 0,
          atrasadas: 0,
        };
        const denom = a.qtd + a.perdidoQtd;
        return {
          vendedor: u.nome,
          vendido: a.vendido,
          qtd: a.qtd,
          aberto: a.aberto,
          conversao_pct: denom > 0 ? a.qtd / denom : null,
          interacoes: a.interacoes,
          pct_com_acao: a.abertas > 0 ? a.comAcao / a.abertas : null,
          acoes_atrasadas: a.atrasadas,
        };
      })
      .sort((a, b) => Number(b.vendido) - Number(a.vendido));

    return {
      linhas,
      filtrosLabel: {
        Mês: mesPorExtenso(mes),
        Linha: linha ?? "Todas",
        Origem: origem ?? "Todas",
        Vendedor: labelVendedor(vendedor),
      },
    };
  },
};

const perdas: RegistroExportacao = {
  id: "perdas",
  titulo: "Relatório — Perdas",
  colunas: [
    { chave: "motivo_perda", titulo: "Motivo", tipo: "texto" },
    { chave: "qtd", titulo: "Qtd", tipo: "inteiro" },
    { chave: "valor", titulo: "Valor", tipo: "moeda" },
  ],
  async query(filtros, supabase) {
    const mes = mesFiltro(filtros);
    const vendedor = pick(filtros, "vendedor");
    const linha = pick(filtros, "linha");

    const rows = await fetchAll((from, to) => {
      let query = supabase
        .from("v_motivos_perda")
        .select("motivo_perda, qtd, valor, responsavel_id, linha, mes")
        .eq("mes", mes)
        .range(from, to);
      if (vendedor) query = query.eq("responsavel_id", vendedor);
      if (linha) query = query.eq("linha", linha);
      return query;
    });

    const byMotivo = new Map<string, { qtd: number; valor: number }>();
    for (const r of rows) {
      const key = r.motivo_perda ?? "—";
      const cur = byMotivo.get(key) ?? { qtd: 0, valor: 0 };
      cur.qtd += Number(r.qtd ?? 0);
      cur.valor += Number(r.valor ?? 0);
      byMotivo.set(key, cur);
    }

    const linhas = [...byMotivo.entries()]
      .map(([motivo_perda, v]) => ({
        motivo_perda,
        qtd: v.qtd,
        valor: v.valor,
      }))
      .sort((a, b) => b.valor - a.valor);

    return {
      linhas,
      filtrosLabel: {
        Mês: mesPorExtenso(mes),
        Vendedor: labelVendedor(vendedor),
        Linha: linha ?? "Todas",
      },
    };
  },
};

const carteiraParada: RegistroExportacao = {
  id: "carteira-parada",
  titulo: "Relatório — Carteira parada",
  colunas: [
    { chave: "tipo", titulo: "Tipo", tipo: "texto" },
    { chave: "empresa_nome", titulo: "Empresa", tipo: "texto" },
    { chave: "titulo", titulo: "Negociação", tipo: "texto" },
    { chave: "valor_estimado", titulo: "Valor", tipo: "moeda" },
    { chave: "dias_sem_interacao", titulo: "Dias sem interação", tipo: "inteiro" },
    { chave: "ultima_interacao", titulo: "Última interação", tipo: "data" },
    { chave: "etapa_nome", titulo: "Etapa", tipo: "texto" },
    { chave: "responsavel_nome", titulo: "Responsável", tipo: "texto" },
  ],
  async query(filtros, supabase) {
    const vendedor = pick(filtros, "vendedor");

    const { data: cfgNeg } = await supabase
      .from("config")
      .select("valor")
      .eq("chave", "dias_parada_negociacao")
      .maybeSingle();
    const diasParada = Math.max(1, Number.parseInt(cfgNeg?.valor ?? "14", 10) || 14);

    const negs = await fetchAll((from, to) => {
      let query = supabase
        .from("v_negociacoes")
        .select(
          "empresa_nome, titulo, valor_estimado, dias_sem_interacao, ultima_interacao, etapa_nome, responsavel_nome, responsavel_id, status",
        )
        .eq("status", "aberta")
        .gte("dias_sem_interacao", diasParada)
        .order("valor_estimado", { ascending: false })
        .range(from, to);
      if (vendedor) query = query.eq("responsavel_id", vendedor);
      return query;
    });

    const linhas = negs.map((n) => ({
      tipo: "Negociação",
      empresa_nome: n.empresa_nome,
      titulo: n.titulo,
      valor_estimado: Number(n.valor_estimado ?? 0),
      dias_sem_interacao: Number(n.dias_sem_interacao ?? 0),
      ultima_interacao: n.ultima_interacao,
      etapa_nome: n.etapa_nome,
      responsavel_nome: n.responsavel_nome,
    }));

    return {
      linhas,
      filtrosLabel: {
        Vendedor: labelVendedor(vendedor),
        "Dias parada": String(diasParada),
      },
    };
  },
};

const produtos: RegistroExportacao = {
  id: "produtos",
  titulo: "Produtos",
  colunas: [
    { chave: "codigo", titulo: "Código", tipo: "texto" },
    { chave: "nome", titulo: "Nome", tipo: "texto" },
    { chave: "descricao", titulo: "Descrição", tipo: "texto" },
    { chave: "linha", titulo: "Linha", tipo: "texto" },
    { chave: "unidade", titulo: "Unidade", tipo: "texto" },
    { chave: "preco_base", titulo: "Preço base", tipo: "moeda" },
    { chave: "ativo", titulo: "Ativo", tipo: "texto" },
  ],
  async query(filtros, supabase) {
    const q = (pick(filtros, "q") ?? "").toLowerCase();
    const rows = await fetchAll((from, to) =>
      supabase
        .from("produtos")
        .select("codigo, nome, descricao, linha, unidade, preco_base, ativo")
        .order("nome", { ascending: true })
        .range(from, to),
    );

    const filtrados = q
      ? rows.filter(
          (p) =>
            (p.nome ?? "").toLowerCase().includes(q) ||
            (p.codigo ?? "").toLowerCase().includes(q),
        )
      : rows;

    return {
      linhas: filtrados.map((p) => ({
        codigo: p.codigo,
        nome: p.nome,
        descricao: p.descricao,
        linha: p.linha,
        unidade: p.unidade,
        preco_base: Number(p.preco_base ?? 0),
        ativo: p.ativo ? "Sim" : "Não",
      })),
      filtrosLabel: { Busca: q || "—" },
    };
  },
};

const orcamentoItens: RegistroExportacao = {
  id: "orcamento-itens",
  titulo: "Orçamento — itens",
  colunas: [
    { chave: "ordem", titulo: "Ordem", tipo: "inteiro" },
    { chave: "codigo", titulo: "Código", tipo: "texto" },
    { chave: "descricao", titulo: "Descrição", tipo: "texto" },
    { chave: "unidade", titulo: "Unidade", tipo: "texto" },
    { chave: "quantidade", titulo: "Qtd", tipo: "inteiro" },
    { chave: "preco_unitario", titulo: "Preço unit.", tipo: "moeda" },
    { chave: "desconto_pct", titulo: "Desconto %", tipo: "percentual" },
    { chave: "total", titulo: "Total", tipo: "moeda" },
  ],
  async query(filtros, supabase) {
    const orcamentoId = pick(filtros, "orcamento_id", "id");
    if (!orcamentoId) {
      throw new Error("Informe orcamento_id para exportar itens.");
    }

    const rows = await fetchAll((from, to) =>
      supabase
        .from("orcamento_itens")
        .select(
          "ordem, descricao, unidade, quantidade, preco_unitario, desconto_pct, total, produtos(codigo)",
        )
        .eq("orcamento_id", orcamentoId)
        .order("ordem", { ascending: true })
        .range(from, to),
    );

    return {
      linhas: rows.map((r) => {
        const prod = r.produtos as
          | { codigo: string | null }
          | { codigo: string | null }[]
          | null;
        const codigo = Array.isArray(prod)
          ? (prod[0]?.codigo ?? null)
          : (prod?.codigo ?? null);
        return {
          ordem: Number(r.ordem ?? 0),
          codigo,
          descricao: r.descricao,
          unidade: r.unidade,
          quantidade: Number(r.quantidade ?? 0),
          preco_unitario: Number(r.preco_unitario ?? 0),
          desconto_pct: Number(r.desconto_pct ?? 0),
          total: Number(r.total ?? 0),
        };
      }),
      filtrosLabel: { Orçamento: orcamentoId },
    };
  },
};

export const EXPORTACOES: RegistroExportacao[] = [
  funilLista,
  empresas,
  contatos,
  acoes,
  relatorioPresidenciaTop,
  previsao,
  ranking,
  perdas,
  carteiraParada,
  produtos,
  orcamentoItens,
];

export const EXPORTACOES_POR_ID = Object.fromEntries(
  EXPORTACOES.map((e) => [e.id, e]),
) as Record<string, RegistroExportacao>;

export function listarIdsExportacao(): string[] {
  return EXPORTACOES.map((e) => e.id);
}
