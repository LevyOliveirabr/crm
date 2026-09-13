/**
 * Gera e dispara download de CSV (UTF-8 com BOM para Excel BR).
 */
export function baixarCsv(
  nomeArquivo: string,
  colunas: { chave: string; titulo: string }[],
  linhas: Record<string, unknown>[],
): void {
  const esc = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = colunas.map((c) => esc(c.titulo)).join(";");
  const body = linhas
    .map((linha) => colunas.map((c) => esc(linha[c.chave])).join(";"))
    .join("\n");
  const csv = `\uFEFF${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".csv") ? nomeArquivo : `${nomeArquivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
