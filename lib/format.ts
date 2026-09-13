const TZ = "America/Sao_Paulo";

const moedaFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dataFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const mesExtensoFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  month: "long",
  year: "numeric",
});

function paraDate(valor: Date | string | number): Date {
  if (valor instanceof Date) return valor;
  if (typeof valor === "number") return new Date(valor);
  // date-only (yyyy-mm-dd) — interpreta como meio-dia UTC para não virar o dia anterior no BR
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return new Date(`${valor}T12:00:00-03:00`);
  }
  return new Date(valor);
}

/** Moeda completa: R$ 1.234.567,89 */
export function formatarMoeda(valor: number | null | undefined): string {
  const n = Number(valor ?? 0);
  return moedaFmt.format(Number.isFinite(n) ? n : 0);
}

/**
 * Moeda curta para relatório/WhatsApp (SPEC 5.9):
 * até R$ 999.999 → `R$ 891 mil`; a partir de 1 mi → `R$ 1,14 mi`.
 */
export function formatarMoedaCurta(valor: number | null | undefined): string {
  const n = Math.abs(Number(valor ?? 0));
  const sinal = Number(valor ?? 0) < 0 ? "-" : "";

  if (!Number.isFinite(n) || n === 0) return "R$ 0";

  if (n >= 1_000_000) {
    const mi = n / 1_000_000;
    const texto = mi
      .toLocaleString("pt-BR", {
        minimumFractionDigits: mi % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 2,
      })
      .replace(/\s/g, "");
    return `${sinal}R$ ${texto} mi`;
  }

  if (n >= 1_000) {
    const mil = n / 1_000;
    const texto = mil
      .toLocaleString("pt-BR", {
        minimumFractionDigits: mil % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
      })
      .replace(/\s/g, "");
    return `${sinal}R$ ${texto} mil`;
  }

  return `${sinal}${formatarMoeda(n)}`;
}

/** Data: dd/mm/aaaa (America/Sao_Paulo) */
export function formatarData(valor: Date | string | number | null | undefined): string {
  if (valor == null || valor === "") return "";
  const d = paraDate(valor);
  if (Number.isNaN(d.getTime())) return "";
  return dataFmt.format(d);
}

/** Data e hora: dd/mm/aaaa, HH:mm (America/Sao_Paulo) */
export function formatarDataHora(
  valor: Date | string | number | null | undefined,
): string {
  if (valor == null || valor === "") return "";
  const d = paraDate(valor);
  if (Number.isNaN(d.getTime())) return "";
  return dataHoraFmt.format(d);
}

/** Mês por extenso: "setembro de 2026" (America/Sao_Paulo) */
export function mesPorExtenso(
  valor: Date | string | number | null | undefined,
): string {
  if (valor == null || valor === "") return "";
  const d = paraDate(valor);
  if (Number.isNaN(d.getTime())) return "";
  return mesExtensoFmt.format(d);
}

/** Data de hoje em America/Sao_Paulo no formato yyyy-mm-dd. */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Soma dias a uma data yyyy-mm-dd (calendário, sem fuso). */
export function adicionarDiasISO(dataISO: string, dias: number): string {
  const [y, m, d] = dataISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** Início do mês corrente (yyyy-mm-01) em America/Sao_Paulo. */
export function inicioMesAtualISO(): string {
  return `${hojeISO().slice(0, 7)}-01`;
}

/** Início do próximo mês (yyyy-mm-01) a partir de uma data yyyy-mm-dd. */
export function inicioProximoMesISO(dataISO: string = hojeISO()): string {
  const [y, m] = dataISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m, 1)); // m já é 1-based → próximo mês
  return dt.toISOString().slice(0, 10);
}

/** Próxima segunda-feira (se hoje for segunda, a seguinte). */
export function proximaSegundaISO(dataISO: string = hojeISO()): string {
  const [y, m, d] = dataISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const diaSemana = dt.getUTCDay(); // 0=dom … 6=sáb
  const add = diaSemana === 0 ? 1 : 8 - diaSemana;
  return adicionarDiasISO(dataISO, add);
}

/** Normaliza nome para comparação sem acento/maiúsculas (R11). */
export function normalizarNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Interpreta texto de moeda BR (`1.234,56`, `R$ 50`, `50`) como número.
 * Retorna `null` se não for possível interpretar.
 */
export function parseMoedaBR(valor: string | number | null | undefined): number | null {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }
  if (valor == null) return null;
  const limpo = String(valor)
    .trim()
    .replace(/[R$\s]/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!limpo) return 0;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Início do mês (yyyy-mm-01) a partir de yyyy-mm ou yyyy-mm-dd. */
export function inicioMesISO(valor: string): string {
  const m = valor.match(/^(\d{4})-(\d{2})/);
  if (!m) return inicioMesAtualISO();
  return `${m[1]}-${m[2]}-01`;
}
