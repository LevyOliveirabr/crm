import { describe, expect, it } from "vitest";

import { marcosPendentes, vendaEmAcompanhamento } from "@/lib/pos-venda";

const base = {
  faturado: false,
  entregue: false,
  pago: false,
  sem_acao: true,
};

describe("vendaEmAcompanhamento", () => {
  it("mantém venda sem os três marcos", () => {
    expect(vendaEmAcompanhamento(base)).toBe(true);
    expect(vendaEmAcompanhamento({ ...base, faturado: true })).toBe(true);
    expect(
      vendaEmAcompanhamento({ ...base, faturado: true, entregue: true }),
    ).toBe(true);
  });

  it("solta a venda quando os três marcos estão feitos e não há tarefa", () => {
    expect(
      vendaEmAcompanhamento({
        faturado: true,
        entregue: true,
        pago: true,
        sem_acao: true,
      }),
    ).toBe(false);
  });

  it("mantém a venda com tarefa aberta mesmo depois dos três marcos", () => {
    expect(
      vendaEmAcompanhamento({
        faturado: true,
        entregue: true,
        pago: true,
        sem_acao: false,
      }),
    ).toBe(true);
  });

  it("lista só o que ainda falta", () => {
    expect(marcosPendentes({ faturado: true, entregue: false, pago: false })).toEqual([
      "Entregar",
      "Receber pagamento",
    ]);
    expect(marcosPendentes({ faturado: true, entregue: true, pago: true })).toEqual([]);
  });
});
