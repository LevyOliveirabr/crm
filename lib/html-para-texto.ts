const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•",
};

/** Converte HTML de e-mail colado em texto simples, preservando parágrafos. */
export function htmlParaTexto(html: string): string {
  const semInvisivel = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  const comQuebras = semInvisivel
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(?:p|div|h[1-6]|blockquote|pre|tr|section|article|header|footer)\s*>/gi,
      "\n\n",
    )
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return normalizarParagrafos(decodificarEntidades(comQuebras));
}

/**
 * Se o clipboard tiver HTML, devolve o texto com parágrafos e a posição do cursor.
 * Sem HTML útil, devolve null para a colagem padrão do navegador seguir.
 */
export function aplicarColagemHtml(
  atual: string,
  inicio: number,
  fim: number,
  html: string,
): { texto: string; cursor: number } | null {
  if (!html.trim()) return null;
  const formatado = htmlParaTexto(html);
  if (!formatado) return null;

  const de = clamp(inicio, 0, atual.length);
  const ate = clamp(fim, de, atual.length);
  const texto = atual.slice(0, de) + formatado + atual.slice(ate);
  return { texto, cursor: de + formatado.length };
}

function normalizarParagrafos(texto: string): string {
  const linhas = texto
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((linha) => linha.replace(/^[\t\u00a0 ]+|[\t\u00a0 ]+$/g, ""));

  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function decodificarEntidades(texto: string): string {
  return texto.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (trecho, corpo: string) => {
      if (corpo[0] === "#") {
        const hexa = corpo[1] === "x" || corpo[1] === "X";
        const codigo = hexa
          ? Number.parseInt(corpo.slice(2), 16)
          : Number.parseInt(corpo.slice(1), 10);
        if (!Number.isFinite(codigo) || codigo < 0 || codigo > 0x10ffff) {
          return trecho;
        }
        return String.fromCodePoint(codigo);
      }
      return ENTIDADES[corpo.toLowerCase()] ?? trecho;
    },
  );
}

function clamp(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}
