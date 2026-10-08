/** Prefixo obrigatório de toda escrita do agente (SPEC R13). */
export function prefixoAgente(textoBruto?: string | null): string {
  const base = (textoBruto ?? "").trim();
  if (!base) return "[agente]";
  if (base.startsWith("[agente]")) return base;
  return `[agente] ${base}`;
}
