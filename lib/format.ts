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
