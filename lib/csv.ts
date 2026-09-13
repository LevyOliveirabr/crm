/**
 * Utilitários de CSV para importação (SPEC seção 6).
 * Detecta separador (; ou ,) e encoding (UTF-8 / windows-1252).
 */

export type CsvParseResult = {
  separator: ";" | ",";
  encoding: "utf-8" | "windows-1252";
  headers: string[];
  rows: string[][];
  /** Linhas de dados (1-based no arquivo, considerando header = linha 1). */
  dataLineNumbers: number[];
};

function decodeBytes(bytes: Uint8Array, encoding: "utf-8" | "windows-1252"): string {
  return new TextDecoder(encoding === "utf-8" ? "utf-8" : "windows-1252", {
    fatal: encoding === "utf-8",
  }).decode(bytes);
}

/** Conta caracteres de substituição / mojibake típicos de encoding errado. */
function scoreEncoding(text: string): number {
  let score = 0;
  for (const ch of text) {
    if (ch === "\uFFFD") score += 5;
    // sequences comuns de UTF-8 lido como Latin-1: Ã¡ Ã§ Ãµ etc.
    if (ch === "Ã" || ch === "Â") score += 2;
  }
  return score;
}

export function detectarEncoding(bytes: Uint8Array): {
  text: string;
  encoding: "utf-8" | "windows-1252";
} {
  try {
    const utf8 = decodeBytes(bytes, "utf-8");
    const latin = decodeBytes(bytes, "windows-1252");
    if (scoreEncoding(utf8) <= scoreEncoding(latin)) {
      return { text: utf8, encoding: "utf-8" };
    }
    return { text: latin, encoding: "windows-1252" };
  } catch {
    return { text: decodeBytes(bytes, "windows-1252"), encoding: "windows-1252" };
  }
}

function detectarSeparador(headerLine: string): ";" | "," {
  const pontos = (headerLine.match(/;/g) ?? []).length;
  const virgulas = (headerLine.match(/,/g) ?? []).length;
  return pontos >= virgulas ? ";" : ",";
}

/** Parse CSV simples com aspas e separador fixo. */
export function parseCsvTexto(
  text: string,
  separator: ";" | ",",
): { headers: string[]; rows: string[][]; dataLineNumbers: number[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headers: string[] = [];
  const rows: string[][] = [];
  const dataLineNumbers: number[] = [];

  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let lineStart = 1;
  let physicalLine = 0;

  const pushField = () => {
    current.push(field);
    field = "";
  };

  const pushRow = () => {
    // ignora linhas totalmente vazias
    if (current.length === 1 && current[0] === "" && !inQuotes) {
      current = [];
      return;
    }
    if (headers.length === 0) {
      headers.push(...current.map((h) => h.trim()));
    } else if (current.some((c) => c.trim() !== "")) {
      rows.push(current);
      dataLineNumbers.push(lineStart);
    }
    current = [];
  };

  for (let i = 0; i < lines.length; i++) {
    physicalLine = i + 1;
    if (!inQuotes) lineStart = physicalLine;
    const line = lines[i] ?? "";
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]!;
      if (inQuotes) {
        if (ch === '"') {
          if (line[j + 1] === '"') {
            field += '"';
            j++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === separator) {
        pushField();
      } else {
        field += ch;
      }
    }
    if (inQuotes) {
      field += "\n";
    } else {
      pushField();
      pushRow();
    }
  }
  if (field !== "" || current.length > 0) {
    pushField();
    pushRow();
  }

  return { headers, rows, dataLineNumbers };
}

export function parseCsvBytes(bytes: Uint8Array): CsvParseResult {
  const { text, encoding } = detectarEncoding(bytes);
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const separator = detectarSeparador(firstLine);
  const parsed = parseCsvTexto(text, separator);
  return { separator, encoding, ...parsed };
}

export function mapearLinha(
  headers: string[],
  row: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i]?.trim() ?? "";
    if (!key) continue;
    out[key] = (row[i] ?? "").trim();
  }
  return out;
}

/** Valores: aceita vírgula ou ponto decimal (SPEC / LEIA-ME). */
export function parseValorCsv(valor: string | null | undefined): number | null {
  if (valor == null) return null;
  const s = String(valor).trim().replace(/[R$\s]/gi, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) {
    // 1.234,56
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (s.includes(",")) {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Datas dd/mm/aaaa → yyyy-mm-dd. */
export function parseDataCsv(valor: string | null | undefined): string | null {
  if (valor == null) return null;
  const s = String(valor).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function normalizarHeader(h: string): string {
  return h.trim().toLowerCase();
}
