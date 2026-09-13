import {
  adicionarDiasISO,
  hojeISO,
  inicioMesAtualISO,
  inicioMesISO,
  inicioProximoMesISO,
} from "@/lib/format";

export type TipoPeriodo = "mes" | "trimestre" | "personalizado";

export type PeriodoResolvido = {
  tipo: TipoPeriodo;
  /** Inclusivo (yyyy-mm-dd). */
  inicio: string;
  /** Exclusivo (yyyy-mm-dd) — fim do intervalo aberto à direita. */
  fimExclusivo: string;
  /** Último dia inclusivo (yyyy-mm-dd). */
  fimInclusivo: string;
  /** Rótulo curto para UI. */
  rotulo: string;
  /** Meses (yyyy-mm-01) cobertos pelo período — útil para views mensais. */
  meses: string[];
  anterior: {
    inicio: string;
    fimExclusivo: string;
    fimInclusivo: string;
    meses: string[];
  };
};

function diasEntre(inicio: string, fimExclusivo: string): number {
  const a = Date.parse(`${inicio}T12:00:00Z`);
  const b = Date.parse(`${fimExclusivo}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function listarMeses(inicio: string, fimExclusivo: string): string[] {
  const fimInc = adicionarDiasISO(fimExclusivo, -1);
  const meses: string[] = [];
  let m = inicioMesISO(inicio);
  const mFim = inicioMesISO(fimInc);
  while (m <= mFim) {
    meses.push(m);
    m = inicioProximoMesISO(m);
    if (meses.length > 36) break;
  }
  return meses;
}

function inicioTrimestreISO(dataISO: string = hojeISO()): string {
  const [y, m] = dataISO.split("-").map(Number);
  const mesTri = Math.floor((m! - 1) / 3) * 3 + 1;
  return `${y}-${String(mesTri).padStart(2, "0")}-01`;
}

function rotuloMes(mesISO: string): string {
  const [y, m] = mesISO.split("-");
  const nomes = [
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
  ];
  return `${nomes[Number(m) - 1]}/${y}`;
}

export function resolverPeriodo(opts: {
  tipo?: string | null;
  mes?: string | null;
  de?: string | null;
  ate?: string | null;
}): PeriodoResolvido {
  const tipo: TipoPeriodo =
    opts.tipo === "trimestre" || opts.tipo === "personalizado"
      ? opts.tipo
      : "mes";

  let inicio: string;
  let fimExclusivo: string;

  if (tipo === "mes") {
    inicio = opts.mes ? inicioMesISO(opts.mes) : inicioMesAtualISO();
    fimExclusivo = inicioProximoMesISO(inicio);
  } else if (tipo === "trimestre") {
    const base = opts.mes ? inicioMesISO(opts.mes) : inicioMesAtualISO();
    inicio = inicioTrimestreISO(base);
    // 3 meses a partir do início do trimestre
    fimExclusivo = inicioProximoMesISO(
      inicioProximoMesISO(inicioProximoMesISO(inicio)),
    );
  } else {
    const de = opts.de && /^\d{4}-\d{2}-\d{2}$/.test(opts.de) ? opts.de : inicioMesAtualISO();
    const ateRaw =
      opts.ate && /^\d{4}-\d{2}-\d{2}$/.test(opts.ate) ? opts.ate : hojeISO();
    inicio = de <= ateRaw ? de : ateRaw;
    const ate = de <= ateRaw ? ateRaw : de;
    fimExclusivo = adicionarDiasISO(ate, 1);
  }

  const fimInclusivo = adicionarDiasISO(fimExclusivo, -1);
  const meses = listarMeses(inicio, fimExclusivo);
  const duracao = diasEntre(inicio, fimExclusivo);
  const antFimExclusivo = inicio;
  const antInicio = adicionarDiasISO(antFimExclusivo, -duracao);

  let rotulo: string;
  if (tipo === "mes") {
    rotulo = rotuloMes(inicio);
  } else if (tipo === "trimestre") {
    const q = Math.floor((Number(inicio.slice(5, 7)) - 1) / 3) + 1;
    rotulo = `T${q}/${inicio.slice(0, 4)}`;
  } else {
    rotulo = `${inicio.split("-").reverse().join("/")} – ${fimInclusivo.split("-").reverse().join("/")}`;
  }

  return {
    tipo,
    inicio,
    fimExclusivo,
    fimInclusivo,
    rotulo,
    meses,
    anterior: {
      inicio: antInicio,
      fimExclusivo: antFimExclusivo,
      fimInclusivo: adicionarDiasISO(antFimExclusivo, -1),
      meses: listarMeses(antInicio, antFimExclusivo),
    },
  };
}

/** Seis meses a partir do mês atual (inclusivo), como yyyy-mm-01. */
export function proximosSeisMeses(aPartirDe: string = inicioMesAtualISO()): string[] {
  const out: string[] = [];
  let cursor = inicioMesISO(aPartirDe);
  for (let i = 0; i < 6; i++) {
    out.push(cursor);
    cursor = inicioProximoMesISO(cursor);
  }
  return out;
}

export function rotuloMesCurto(mesISO: string): string {
  const nomes = [
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
  ];
  const m = Number(mesISO.slice(5, 7));
  return nomes[m - 1] ?? mesISO;
}

/** Δ% entre atual e anterior. `null` se anterior for 0. */
export function deltaPct(
  atual: number,
  anterior: number,
): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) return null;
  return Math.round(((atual / anterior - 1) * 1000)) / 10;
}

export function formatarDeltaPct(delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta)) return "—";
  const sinal = delta > 0 ? "+" : "";
  return `${sinal}${delta.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}
