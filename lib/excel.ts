import ExcelJS from "exceljs";

export type ColunaExcel = {
  chave: string;
  titulo: string;
  tipo?: "texto" | "moeda" | "inteiro" | "data" | "percentual";
};

export type ExportarExcelOpts = {
  nomeArquivo: string; // sem extensão
  titulo: string; // linha 1 da planilha
  filtros?: Record<string, string>; // linha 2
  colunas: ColunaExcel[];
  linhas: Record<string, unknown>[];
};

const FMT_MOEDA = 'R$ #.##0,00';
const FMT_DATA = "dd/mm/yyyy";
const FMT_PCT = "0.0%";

/** Monta o rótulo da linha 2 a partir dos filtros ativos. */
export function textoFiltros(filtros?: Record<string, string>): string {
  if (!filtros) return "";
  const partes = Object.entries(filtros)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`);
  return partes.join(" · ");
}

/** Nome final do arquivo: `<nome>_<aaaa-mm-dd>.xlsx`. */
export function nomeArquivoComData(nomeArquivo: string, data = new Date()): string {
  const base = nomeArquivo.replace(/\.xlsx$/i, "").trim() || "exportacao";
  const yyyy = data.getFullYear();
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  const dd = String(data.getDate()).padStart(2, "0");
  return `${base}_${yyyy}-${mm}-${dd}.xlsx`;
}

function paraNumero(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "boolean") return valor ? 1 : 0;
  const s = String(valor).trim();
  if (!s) return null;
  // aceita "1.234,56" ou "1234.56"
  const normalizado = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

function paraData(valor: unknown): Date | null {
  if (valor == null || valor === "") return null;
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }
  if (typeof valor === "number") {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(valor).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00-03:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function valorCelula(
  tipo: ColunaExcel["tipo"],
  bruto: unknown,
): string | number | Date | null {
  switch (tipo) {
    case "moeda":
    case "inteiro": {
      const n = paraNumero(bruto);
      return n == null ? null : tipo === "inteiro" ? Math.round(n) : n;
    }
    case "percentual": {
      const n = paraNumero(bruto);
      if (n == null) return null;
      // aceita 41 ou 0.41 → fração Excel
      return Math.abs(n) > 1 ? n / 100 : n;
    }
    case "data":
      return paraData(bruto);
    case "texto":
    default:
      if (bruto == null) return null;
      if (typeof bruto === "boolean") return bruto ? "Sim" : "Não";
      return String(bruto);
  }
}

function numFmt(tipo: ColunaExcel["tipo"]): string | undefined {
  switch (tipo) {
    case "moeda":
      return FMT_MOEDA;
    case "data":
      return FMT_DATA;
    case "percentual":
      return FMT_PCT;
    case "inteiro":
      return "0";
    default:
      return undefined;
  }
}

/**
 * Gera um .xlsx com título (L1), filtros (L2), cabeçalho com autofiltro e
 * painel congelado (L3), tipos tipados e linha de total para moeda/inteiro.
 */
export async function exportarExcel(opts: ExportarExcelOpts): Promise<Buffer> {
  const { titulo, filtros, colunas, linhas } = opts;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CRM F-Led";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Dados", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 3, activeCell: "A4" }],
  });

  const colCount = Math.max(colunas.length, 1);

  // Linha 1 — título
  sheet.mergeCells(1, 1, 1, colCount);
  const tituloCell = sheet.getCell(1, 1);
  tituloCell.value = titulo;
  tituloCell.font = { bold: true, size: 14 };

  // Linha 2 — filtros
  sheet.mergeCells(2, 1, 2, colCount);
  const filtroCell = sheet.getCell(2, 1);
  const filtroTexto = textoFiltros(filtros);
  filtroCell.value = filtroTexto || "Filtros: nenhum";
  filtroCell.font = { italic: true, size: 10, color: { argb: "FF666666" } };

  // Linha 3 — cabeçalho
  colunas.forEach((col, i) => {
    const cell = sheet.getCell(3, i + 1);
    cell.value = col.titulo;
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle" };
  });

  if (colunas.length > 0) {
    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3, column: colunas.length },
    };
  }

  // Dados
  linhas.forEach((linha, rowIdx) => {
    const excelRow = 4 + rowIdx;
    colunas.forEach((col, colIdx) => {
      const cell = sheet.getCell(excelRow, colIdx + 1);
      const tipo = col.tipo ?? "texto";
      const valor = valorCelula(tipo, linha[col.chave]);
      cell.value = valor;
      const fmt = numFmt(tipo);
      if (fmt && valor != null) cell.numFmt = fmt;
    });
  });

  // Linha de total (moeda / inteiro)
  const temTotal = colunas.some(
    (c) => c.tipo === "moeda" || c.tipo === "inteiro",
  );
  if (temTotal && linhas.length > 0) {
    const totalRow = 4 + linhas.length;
    const firstData = 4;
    const lastData = totalRow - 1;

    colunas.forEach((col, colIdx) => {
      const cell = sheet.getCell(totalRow, colIdx + 1);
      cell.font = { bold: true };
      if (colIdx === 0) {
        cell.value = "Total";
        return;
      }
      if (col.tipo === "moeda" || col.tipo === "inteiro") {
        const letter = sheet.getColumn(colIdx + 1).letter;
        cell.value = {
          formula: `SUM(${letter}${firstData}:${letter}${lastData})`,
        };
        const fmt = numFmt(col.tipo);
        if (fmt) cell.numFmt = fmt;
      }
    });
  }

  // Largura automática
  colunas.forEach((col, i) => {
    let maxLen = col.titulo.length;
    for (const linha of linhas) {
      const v = linha[col.chave];
      if (v == null) continue;
      const len = String(v).length;
      if (len > maxLen) maxLen = len;
    }
    const width =
      col.tipo === "moeda"
        ? Math.min(Math.max(maxLen, 12), 18)
        : col.tipo === "data"
          ? 12
          : Math.min(Math.max(maxLen + 2, 10), 40);
    sheet.getColumn(i + 1).width = width;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
