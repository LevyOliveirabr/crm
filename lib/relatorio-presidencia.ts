import {
  formatarData,
  formatarMoeda,
  formatarMoedaCurta,
  hojeISO,
  mesPorExtenso,
} from "@/lib/format";

export type PrevisaoMes = {
  mes: string;
  aberto: number;
  realista: number;
  otimista: number;
};

export type TopNegociacao = {
  empresa_nome: string;
  titulo: string | null;
  valor_estimado: number;
  etapa_nome: string | null;
  proxima_acao_descricao: string | null;
  proxima_acao_data: string | null;
  responsavel_nome: string | null;
};

export type PerdaMes = {
  motivo_perda: string | null;
  qtd: number;
  valor: number;
};

export type RelatorioPresidencia = {
  mes: string;
  vendido: number;
  qtd_vendida: number;
  ticket_medio: number;
  vendido_mes_anterior: number;
  variacao_pct: number | null;
  perdido: number;
  qtd_perdida: number;
  conversao_pct: number | null;
  previsao: PrevisaoMes[] | null;
  top_negociacoes: TopNegociacao[] | null;
  perdas: PerdaMes[] | null;
};

export type FunilEtapaBarra = {
  funilId: string;
  funil: string;
  etapaId: string;
  etapa: string;
  ordem: number;
  qtd: number;
  valor: number;
};

const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

function paraDateMes(valor: string): Date {
  const m = valor.match(/^(\d{4})-(\d{2})/);
  if (!m) return new Date(`${hojeISO().slice(0, 7)}-01T12:00:00-03:00`);
  return new Date(`${m[1]}-${m[2]}-01T12:00:00-03:00`);
}

/** "Setembro/2026" */
export function mesTitulo(valor: string): string {
  const texto = mesPorExtenso(paraDateMes(valor));
  if (!texto) return valor;
  const [mes, , ano] = texto.split(" ");
  const mesCap = mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : "";
  return `${mesCap}/${ano}`;
}

/** "Set", "Out", … */
export function mesCurto(valor: string): string {
  const d = paraDateMes(valor);
  return MESES_CURTOS[d.getMonth()] ?? "";
}

/** Nome do mês anterior em minúsculas: "agosto" */
export function nomeMesAnterior(valor: string): string {
  const d = paraDateMes(valor);
  d.setMonth(d.getMonth() - 1);
  const texto = mesPorExtenso(d);
  return texto.split(" ")[0] ?? "";
}

function proximoPasso(n: TopNegociacao): string {
  const desc = (n.proxima_acao_descricao ?? "").trim();
  const data = n.proxima_acao_data
    ? formatarData(n.proxima_acao_data).slice(0, 5)
    : "";
  if (desc && data) return `${desc} ${data}`;
  if (desc) return desc;
  if (data) return data;
  return "—";
}

function formatarVariacao(
  pct: number | null,
  mesRef: string,
): string {
  if (pct == null || !Number.isFinite(pct)) return "";
  const sinal = pct > 0 ? "+" : "";
  return ` (${sinal}${pct}% vs. ${nomeMesAnterior(mesRef)})`;
}

/**
 * Texto WhatsApp exatamente no formato da SPEC 5.9.
 */
export function montarTextoWhatsApp(
  relatorio: RelatorioPresidencia,
  comentario: string,
  ate: string = hojeISO(),
): string {
  const mes = relatorio.mes;
  const ateFmt = formatarData(ate).slice(0, 5);
  const variacao = formatarVariacao(relatorio.variacao_pct, mes);
  const conversao =
    relatorio.conversao_pct == null
      ? "—"
      : `${relatorio.conversao_pct}%`;

  const linhas: string[] = [
    "*F-Led · Vendas e previsão*",
    `${mesTitulo(mes)} · até ${ateFmt}`,
    "",
    "*Resultado do mês*",
    `Vendido: ${formatarMoedaCurta(relatorio.vendido)}${variacao} · ${relatorio.qtd_vendida} negócios · ticket ${formatarMoedaCurta(relatorio.ticket_medio)}`,
    `Perdido: ${formatarMoedaCurta(relatorio.perdido)} (${relatorio.qtd_perdida}) · Conversão: ${conversao}`,
    "",
    "*Previsão de fechamento*",
  ];

  const previsoes = relatorio.previsao ?? [];
  if (previsoes.length === 0) {
    linhas.push("Sem previsão");
  } else {
    previsoes.forEach((p, i) => {
      const curto = mesCurto(p.mes);
      if (i === 0) {
        linhas.push(
          `${curto} (restante): ${formatarMoedaCurta(p.realista)} realista / ${formatarMoedaCurta(p.otimista)} otimista`,
        );
      } else {
        linhas.push(
          `${curto}: ${formatarMoedaCurta(p.realista)} / ${formatarMoedaCurta(p.otimista)}`,
        );
      }
    });
  }

  linhas.push("", "*Maiores negociações em andamento*");
  const tops = relatorio.top_negociacoes ?? [];
  if (tops.length === 0) {
    linhas.push("Sem negociações em aberto");
  } else {
    for (const n of tops) {
      linhas.push(
        `• ${n.empresa_nome} – ${formatarMoedaCurta(n.valor_estimado)} – ${n.etapa_nome ?? "—"} – ${proximoPasso(n)}`,
      );
    }
  }

  linhas.push("", "*Perdas do mês*");
  const perdas = relatorio.perdas ?? [];
  if (perdas.length === 0) {
    linhas.push("Nenhuma");
  } else {
    linhas.push(
      perdas
        .map((p) => `${p.motivo_perda ?? "Sem motivo"} (${p.qtd})`)
        .join(", "),
    );
  }

  linhas.push("", "*Comentário*", comentario.trim() || "—");

  return linhas.join("\n");
}

export function formatarVariacaoPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sinal = pct > 0 ? "+" : "";
  return `${sinal}${pct}%`;
}

export function valorOuZero(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function parseRelatorioPresidencia(raw: unknown): RelatorioPresidencia {
  const r = (raw ?? {}) as Record<string, unknown>;
  const previsaoRaw = r.previsao;
  const topsRaw = r.top_negociacoes;
  const perdasRaw = r.perdas;

  return {
    mes: String(r.mes ?? inicioMesFallback()),
    vendido: valorOuZero(r.vendido),
    qtd_vendida: valorOuZero(r.qtd_vendida),
    ticket_medio: valorOuZero(r.ticket_medio),
    vendido_mes_anterior: valorOuZero(r.vendido_mes_anterior),
    variacao_pct:
      r.variacao_pct == null ? null : valorOuZero(r.variacao_pct),
    perdido: valorOuZero(r.perdido),
    qtd_perdida: valorOuZero(r.qtd_perdida),
    conversao_pct:
      r.conversao_pct == null ? null : valorOuZero(r.conversao_pct),
    previsao: Array.isArray(previsaoRaw)
      ? previsaoRaw.map((p) => {
          const row = p as Record<string, unknown>;
          return {
            mes: String(row.mes ?? ""),
            aberto: valorOuZero(row.aberto),
            realista: valorOuZero(row.realista),
            otimista: valorOuZero(row.otimista),
          };
        })
      : null,
    top_negociacoes: Array.isArray(topsRaw)
      ? topsRaw.map((n) => {
          const row = n as Record<string, unknown>;
          return {
            empresa_nome: String(row.empresa_nome ?? "—"),
            titulo: row.titulo == null ? null : String(row.titulo),
            valor_estimado: valorOuZero(row.valor_estimado),
            etapa_nome:
              row.etapa_nome == null ? null : String(row.etapa_nome),
            proxima_acao_descricao:
              row.proxima_acao_descricao == null
                ? null
                : String(row.proxima_acao_descricao),
            proxima_acao_data:
              row.proxima_acao_data == null
                ? null
                : String(row.proxima_acao_data),
            responsavel_nome:
              row.responsavel_nome == null
                ? null
                : String(row.responsavel_nome),
          };
        })
      : null,
    perdas: Array.isArray(perdasRaw)
      ? perdasRaw.map((p) => {
          const row = p as Record<string, unknown>;
          return {
            motivo_perda:
              row.motivo_perda == null ? null : String(row.motivo_perda),
            qtd: valorOuZero(row.qtd),
            valor: valorOuZero(row.valor),
          };
        })
      : null,
  };
}

function inicioMesFallback(): string {
  return `${hojeISO().slice(0, 7)}-01`;
}

/** Reexport útil para a UI do relatório. */
export { formatarMoeda, formatarMoedaCurta, formatarData };
