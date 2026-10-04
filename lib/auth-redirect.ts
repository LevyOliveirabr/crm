/**
 * Garante que o destino pós-login é um caminho interno do app
 * (evita open redirect via `?next=https://...` ou `//host`).
 */
export function nextSeguro(valor: string | null | undefined, fallback = "/hoje"): string {
  if (!valor) return fallback;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) {
    return fallback;
  }
  return valor;
}
