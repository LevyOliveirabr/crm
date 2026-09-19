import { describe, expect, it } from "vitest";

import { formatarCnpj, validarCnpj } from "@/lib/cnpj";

describe("CNPJ", () => {
  it("aceita CNPJ válido com ou sem máscara", () => {
    expect(validarCnpj("11.222.333/0001-81")).toBe(true);
    expect(validarCnpj("11222333000181")).toBe(true);
  });

  it("rejeita dígito verificador errado e sequências repetidas", () => {
    expect(validarCnpj("11.222.333/0001-80")).toBe(false);
    expect(validarCnpj("00000000000000")).toBe(false);
    expect(validarCnpj("123")).toBe(false);
  });

  it("formata com máscara", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpj("123")).toBe("123");
  });
});
