import { beforeAll, describe, expect, it } from "vitest";

import { gerarTokenAceite, verificarTokenAceite } from "@/lib/orcamentos/aceite-token";

describe("token de aceite de orçamento", () => {
  beforeAll(() => {
    process.env.ACEITE_SECRET = "segredo-de-teste-com-tamanho-suficiente-123";
  });

  it("gera e valida um token para o orçamento", async () => {
    const id = "3f2c1c1e-7a1b-4d7b-9c1e-2e1a3b4c5d6e";
    const token = await gerarTokenAceite(id);
    expect(await verificarTokenAceite(token)).toBe(id);
  });

  it("rejeita token adulterado ou de outro segredo", async () => {
    const token = await gerarTokenAceite("3f2c1c1e-7a1b-4d7b-9c1e-2e1a3b4c5d6e");
    expect(await verificarTokenAceite(`${token}x`)).toBeNull();
    process.env.ACEITE_SECRET = "outro-segredo-completamente-diferente-456";
    expect(await verificarTokenAceite(token)).toBeNull();
  });
});
