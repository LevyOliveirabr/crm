import { describe, expect, it } from "vitest";

import {
  calcularWinRate,
  pesoNegociacao,
  valorPrevisaoEfetivo,
} from "@/lib/dashboard/dados";

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

describe("valorPrevisaoEfetivo", () => {
  it("usa valor_previsao quando informado", () => {
    expect(
      valorPrevisaoEfetivo({ valor_estimado: 100_000, valor_previsao: 40_000 }),
    ).toBe(40_000);
  });

  it("cai para valor_estimado quando previsão é null", () => {
    expect(
      valorPrevisaoEfetivo({ valor_estimado: 100_000, valor_previsao: null }),
    ).toBe(100_000);
  });

  it("trata 0 como previsão válida (não faz fallback)", () => {
    expect(
      valorPrevisaoEfetivo({ valor_estimado: 100_000, valor_previsao: 0 }),
    ).toBe(0);
  });
});

describe("calcularWinRate (sem venda fantasma)", () => {
  it("usa valor_final nas vendidas e valor_estimado nas perdidas", () => {
    const r = calcularWinRate([
      { status: "vendida", valor_final: 80_000, valor_estimado: 100_000 },
      { status: "perdida", valor_final: null, valor_estimado: 20_000 },
    ]);
    // 80000 / (80000+20000) = 80%
    expect(r.taxa).toBe(80);
    expect(r.taxaNegocio).toBe(50);
    expect(r.vendidas).toBe(1);
    expect(r.perdidas).toBe(1);
  });

  it("ignora abertas no cálculo", () => {
    const r = calcularWinRate([
      { status: "aberta", valor_final: null, valor_estimado: 999_999 },
      { status: "vendida", valor_final: 50_000, valor_estimado: 60_000 },
    ]);
    expect(r.taxa).toBe(100);
    expect(r.vendidas).toBe(1);
    expect(r.perdidas).toBe(0);
  });

  it("não conta valor_estimado de vendida no numerador", () => {
    // Venda fantasma: se usasse valor_estimado (200k) em vez de valor_final (10k),
    // a taxa ficaria distorcida.
    const r = calcularWinRate([
      { status: "vendida", valor_final: 10_000, valor_estimado: 200_000 },
      { status: "perdida", valor_final: null, valor_estimado: 10_000 },
    ]);
    expect(r.taxa).toBe(50);
  });

  it("retorna null sem fechamentos", () => {
    expect(calcularWinRate([]).taxa).toBeNull();
  });
});
