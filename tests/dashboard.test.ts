import { describe, expect, it } from "vitest";

import { pesoNegociacao } from "@/lib/dashboard/dados";

const pesos = { fria: 0.2, morna: 0.5, quente: 0.8 };

describe("pesoNegociacao (pipeline ponderado)", () => {
  it("usa a probabilidade da etapa quando cadastrada", () => {
    expect(pesoNegociacao({ temperatura: 1, etapa_probabilidade: 60 }, pesos)).toBe(0.6);
    expect(pesoNegociacao({ temperatura: 3, etapa_probabilidade: 0 }, pesos)).toBe(0);
  });

  it("cai para a temperatura sem probabilidade", () => {
    expect(pesoNegociacao({ temperatura: 1, etapa_probabilidade: null }, pesos)).toBe(0.2);
    expect(pesoNegociacao({ temperatura: 2, etapa_probabilidade: null }, pesos)).toBe(0.5);
    expect(pesoNegociacao({ temperatura: 3, etapa_probabilidade: null }, pesos)).toBe(0.8);
    expect(pesoNegociacao({ temperatura: null, etapa_probabilidade: null }, pesos)).toBe(0.5);
  });

  it("limita a probabilidade ao intervalo 0–1", () => {
    expect(pesoNegociacao({ temperatura: 2, etapa_probabilidade: 150 }, pesos)).toBe(1);
  });
});
