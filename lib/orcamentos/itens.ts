/**
 * Regras puras do orçamento montado por itens (compartilhadas entre as server
 * actions, o MCP e os testes). Sem acesso a banco.
 */

export type ItemEntrada = {
  produto_id?: string | null;
  descricao?: string | null;
  unidade?: string | null;
  quantidade?: number | null;
  preco_unitario?: number | null;
  desconto_pct?: number | null;
};

export type ProdutoBase = {
  id: string;
  nome: string;
  descricao: string | null;
  unidade: string;
  preco_base: number;
  emitente_id: string;
};

export type ItemNormalizado = {
  produto_id: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  desconto_pct: number;
};

/**
 * Monta a linha do item a partir da entrada e, se houver, do produto do
 * catálogo: descrição e preço nascem do produto e são sempre editáveis (R6a).
 */
export function normalizarItem(
  entrada: ItemEntrada,
  produto: ProdutoBase | null,
): { ok: true; item: ItemNormalizado } | { ok: false; erro: string } {
  const descricao = (entrada.descricao ?? "").trim() || produto?.descricao?.trim() || produto?.nome?.trim() || "";
  if (!descricao) return { ok: false, erro: "Informe a descrição do item ou escolha um produto." };

  const quantidade = Number(entrada.quantidade ?? 1);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { ok: false, erro: "Quantidade deve ser maior que zero." };
  }

  const preco = entrada.preco_unitario == null ? (produto?.preco_base ?? 0) : Number(entrada.preco_unitario);
  if (!Number.isFinite(preco) || preco < 0) return { ok: false, erro: "Preço unitário inválido." };

  const desconto = Number(entrada.desconto_pct ?? 0);
  if (!Number.isFinite(desconto) || desconto < 0 || desconto > 100) {
    return { ok: false, erro: "Desconto deve estar entre 0 e 100%." };
  }

  return {
    ok: true,
    item: {
      produto_id: produto?.id ?? null,
      descricao,
      unidade: (entrada.unidade ?? "").trim() || produto?.unidade || "un",
      quantidade: Math.round(quantidade * 1000) / 1000,
      preco_unitario: Math.round(preco * 100) / 100,
      desconto_pct: Math.round(desconto * 100) / 100,
    },
  };
}

export function totalItem(i: Pick<ItemNormalizado, "quantidade" | "preco_unitario" | "desconto_pct">): number {
  return Math.round(i.quantidade * i.preco_unitario * (1 - i.desconto_pct / 100) * 100) / 100;
}

export function totais(
  itens: Pick<ItemNormalizado, "quantidade" | "preco_unitario" | "desconto_pct">[],
  descontoGeralPct = 0,
): { subtotal: number; total: number } {
  const subtotal = Math.round(itens.reduce((s, i) => s + totalItem(i), 0) * 100) / 100;
  const total = Math.round(subtotal * (1 - (descontoGeralPct || 0) / 100) * 100) / 100;
  return { subtotal, total };
}

export type LinkProposta = {
  tipo: "site" | "catalogo_categoria" | "catalogo_produto" | "produto";
  titulo: string;
  url: string;
};

export type ItemComLinks = {
  descricao: string;
  produto: {
    nome: string;
    link: string | null;
    catalogoUrl: string | null;
    categoria: { nome: string; catalogoUrl: string | null } | null;
  } | null;
};

/**
 * Lista deduplicada de materiais para a seção "Materiais e links" da
 * proposta: site da empresa, catálogos de categoria, catálogos e páginas dos
 * produtos, na ordem em que aparecem.
 */
export function montarLinksProposta(
  emitente: { nome: string; site: string | null } | null,
  itens: ItemComLinks[],
): LinkProposta[] {
  const out: LinkProposta[] = [];
  const vistos = new Set<string>();
  const add = (l: LinkProposta) => {
    const k = `${l.tipo}|${l.url}`;
    if (!l.url || vistos.has(k)) return;
    vistos.add(k);
    out.push(l);
  };
  if (emitente?.site) add({ tipo: "site", titulo: `Site ${emitente.nome}`, url: emitente.site });
  for (const i of itens) {
    const p = i.produto;
    if (!p) continue;
    if (p.categoria?.catalogoUrl) {
      add({ tipo: "catalogo_categoria", titulo: `Catálogo ${p.categoria.nome}`, url: p.categoria.catalogoUrl });
    }
  }
  for (const i of itens) {
    const p = i.produto;
    if (!p) continue;
    if (p.catalogoUrl) add({ tipo: "catalogo_produto", titulo: `Catálogo ${p.nome}`, url: p.catalogoUrl });
    if (p.link) add({ tipo: "produto", titulo: `${p.nome} no site`, url: p.link });
  }
  return out;
}
