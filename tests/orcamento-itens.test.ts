import { describe, expect, it } from "vitest";

import {
  montarLinksProposta,
  normalizarItem,
  totais,
  totalItem,
} from "@/lib/orcamentos/itens";

const produto = {
  id: "p1",
  nome: "Luminária LED 150W",
  descricao: "Luminária pública LED 150W, IP66",
  unidade: "un",
  preco_base: 890,
  emitente_id: "e1",
};

describe("normalizarItem", () => {
  it("nasce do produto: descrição, unidade e preço base (R6a)", () => {
    const r = normalizarItem({ produto_id: "p1", quantidade: 2 }, produto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item).toEqual({
      produto_id: "p1",
      descricao: "Luminária pública LED 150W, IP66",
      unidade: "un",
      quantidade: 2,
      preco_unitario: 890,
      desconto_pct: 0,
    });
  });

  it("preço e descrição informados sobrescrevem o produto", () => {
    const r = normalizarItem({ produto_id: "p1", quantidade: 1, preco_unitario: 800.456, descricao: "Custom" }, produto);
    expect(r.ok && r.item.preco_unitario).toBe(800.46);
    expect(r.ok && r.item.descricao).toBe("Custom");
  });

  it("item livre exige descrição; quantidade e desconto válidos", () => {
    expect(normalizarItem({ quantidade: 1 }, null).ok).toBe(false);
    expect(normalizarItem({ descricao: "Serviço", quantidade: 0 }, null).ok).toBe(false);
    expect(normalizarItem({ descricao: "Serviço", quantidade: 1, desconto_pct: 120 }, null).ok).toBe(false);
    const ok = normalizarItem({ descricao: "Serviço", quantidade: 1.5, preco_unitario: 100 }, null);
    expect(ok.ok && ok.item.produto_id).toBeNull();
    expect(ok.ok && ok.item.unidade).toBe("un");
  });
});

describe("totais", () => {
  it("calcula total do item e do orçamento com desconto geral, ao centavo", () => {
    const itens = [
      { quantidade: 3, preco_unitario: 10.33, desconto_pct: 10 },
      { quantidade: 1, preco_unitario: 0.01, desconto_pct: 0 },
    ];
    expect(totalItem(itens[0]!)).toBe(27.89);
    expect(totais(itens, 5)).toEqual({ subtotal: 27.9, total: 26.51 });
    expect(totais([], 0)).toEqual({ subtotal: 0, total: 0 });
  });
});

describe("montarLinksProposta", () => {
  const cat = { nome: "Luminárias", catalogoUrl: "https://x.com/cat.pdf" };
  const itens = [
    { descricao: "A", produto: { nome: "Lum 150", link: "https://x.com/lum150", catalogoUrl: "https://x.com/lum150.pdf", categoria: cat } },
    { descricao: "B", produto: { nome: "Lum 100", link: null, catalogoUrl: null, categoria: cat } },
    { descricao: "C", produto: null },
    { descricao: "D", produto: { nome: "Lum 150", link: "https://x.com/lum150", catalogoUrl: "https://x.com/lum150.pdf", categoria: cat } },
  ];

  it("site primeiro, depois catálogos de categoria, depois produtos, sem repetir", () => {
    const links = montarLinksProposta({ nome: "F-Led", site: "https://fled.com.br" }, itens);
    expect(links.map((l) => `${l.tipo}:${l.url}`)).toEqual([
      "site:https://fled.com.br",
      "catalogo_categoria:https://x.com/cat.pdf",
      "catalogo_produto:https://x.com/lum150.pdf",
      "produto:https://x.com/lum150",
    ]);
  });

  it("sem emitente e sem produtos não há links", () => {
    expect(montarLinksProposta(null, [{ descricao: "X", produto: null }])).toEqual([]);
  });
});
