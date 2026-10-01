import { describe, expect, it } from "vitest";

import {
  agregarPorEmpresa,
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

describe("agregarPorEmpresa (comparativo no escopo Todas)", () => {
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  const C = "33333333-3333-3333-3333-333333333333";

  const aberta = (
    emitente: string,
    valor: number,
    extra: Partial<{
      valor_previsao: number | null;
      temperatura: number | null;
      etapa_probabilidade: number | null;
      sem_acao: boolean;
      acao_atrasada: boolean;
      dias_sem_interacao: number;
    }> = {},
  ) => ({
    emitente_id: emitente,
    emitente_nome: emitente === A ? "Alfa" : emitente === B ? "Beta" : "Gama",
    valor_estimado: valor,
    valor_previsao: extra.valor_previsao ?? null,
    temperatura: extra.temperatura ?? 2,
    etapa_probabilidade: extra.etapa_probabilidade ?? null,
    sem_acao: extra.sem_acao ?? false,
    acao_atrasada: extra.acao_atrasada ?? false,
    dias_sem_interacao: extra.dias_sem_interacao ?? 0,
  });

  const abertas = [
    aberta(A, 300_000, { valor_previsao: 200_000, sem_acao: true }),
    aberta(A, 100_000),
    aberta(B, 600_000, { dias_sem_interacao: 40 }),
  ];

  it("soma por empresa bate com o total e calcula a participação", () => {
    const r = agregarPorEmpresa({
      abertas,
      doMes: [],
      vendidasMes: [],
      fechadas: [],
      metas: [],
      pesos,
      diasRisco: 15,
    });
    expect(r.map((l) => l.nome)).toEqual(["Beta", "Alfa"]);
    const total = r.reduce((s, l) => s + l.pipeline, 0);
    expect(total).toBe(1_000_000);
    expect(r[0]).toMatchObject({
      emitenteId: B,
      pipeline: 600_000,
      qtdAbertas: 1,
      participacaoPct: 60,
      previsao: 600_000,
      qtdEmRisco: 1,
    });
    expect(r[1]).toMatchObject({
      emitenteId: A,
      pipeline: 400_000,
      qtdAbertas: 2,
      participacaoPct: 40,
      // 200k de previsão informada + 100k de fallback no potencial
      previsao: 300_000,
      qtdEmRisco: 1,
    });
  });

  it("inclui empresas do escopo sem dados, zeradas, no fim", () => {
    const r = agregarPorEmpresa({
      abertas,
      doMes: [],
      vendidasMes: [],
      fechadas: [],
      metas: [],
      empresas: [
        { id: C, nome: "Gama" },
        { id: A, nome: "Alfa" },
      ],
      pesos,
      diasRisco: 15,
    });
    expect(r.map((l) => l.nome)).toEqual(["Beta", "Alfa", "Gama"]);
    expect(r[2]).toMatchObject({ pipeline: 0, participacaoPct: 0, winRate: null });
  });

  it("meta vs vendido, win rate e forecast ponderado por empresa", () => {
    const r = agregarPorEmpresa({
      abertas,
      doMes: [aberta(A, 100_000, { temperatura: 3 }), aberta(B, 50_000, { etapa_probabilidade: 50 })],
      vendidasMes: [
        { emitente_id: A, valor_final: 80_000 },
        { emitente_id: A, valor_final: 20_000 },
        { emitente_id: B, valor_final: 10_000 },
      ],
      fechadas: [
        { emitente_id: A, status: "vendida", valor_final: 80_000, valor_estimado: 90_000 },
        { emitente_id: A, status: "perdida", valor_final: null, valor_estimado: 20_000 },
      ],
      metas: [
        { emitente_id: A, valor: 150_000, tipo: "faturamento" },
        { emitente_id: A, valor: 50_000 },
        { emitente_id: A, valor: 999_999, tipo: "pipeline" },
        { emitente_id: B, valor: 40_000, tipo: "faturamento" },
      ],
      pesos,
      diasRisco: 15,
    });
    const alfa = r.find((l) => l.emitenteId === A)!;
    const beta = r.find((l) => l.emitenteId === B)!;
    expect(alfa.vendidoMes).toBe(100_000);
    expect(alfa.metaMes).toBe(200_000);
    expect(alfa.winRate).toBe(80);
    expect(alfa.forecastMes).toBe(80_000);
    expect(beta.vendidoMes).toBe(10_000);
    expect(beta.metaMes).toBe(40_000);
    expect(beta.winRate).toBeNull();
    expect(beta.forecastMes).toBe(25_000);
  });

  it("ignora linhas sem empresa vendedora", () => {
    const r = agregarPorEmpresa({
      abertas: [{ ...aberta(A, 10), emitente_id: null }],
      doMes: [],
      vendidasMes: [{ emitente_id: null, valor_final: 5 }],
      fechadas: [],
      metas: [],
      pesos,
      diasRisco: 15,
    });
    expect(r).toEqual([]);
  });
});
