import { describe, expect, it } from "vitest";

import { deltaPct, resolverPeriodo } from "@/lib/relatorios/periodo";

describe("resolverPeriodo", () => {
  it("mês fechado cobre o mês inteiro e o anterior", () => {
    const p = resolverPeriodo({ tipo: "mes", mes: "2026-09" });
    expect(p.inicio).toBe("2026-09-01");
    expect(p.fimExclusivo).toBe("2026-10-01");
    expect(p.meses).toEqual(["2026-09-01"]);
    expect(p.anterior.inicio).toBe("2026-08-01");
  });

  it("período personalizado lista os meses cobertos", () => {
    const p = resolverPeriodo({ tipo: "personalizado", de: "2026-01-15", ate: "2026-03-02" });
    expect(p.meses).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(p.fimInclusivo).toBe("2026-03-02");
  });
});

describe("deltaPct", () => {
  it("calcula variação percentual e trata zero", () => {
    expect(deltaPct(120, 100)).toBe(20);
    expect(deltaPct(50, 100)).toBe(-50);
    expect(deltaPct(10, 0)).toBeNull();
  });
});

describe("período anterior", () => {
  it("trimestre compara com os três meses anteriores", () => {
    const p = resolverPeriodo({ tipo: "trimestre", mes: "2026-04" });
    expect(p.inicio).toBe("2026-04-01");
    expect(p.fimExclusivo).toBe("2026-07-01");
    expect(p.anterior.inicio).toBe("2026-01-01");
    expect(p.anterior.meses).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  it("janeiro compara com dezembro do ano anterior", () => {
    const p = resolverPeriodo({ tipo: "mes", mes: "2026-01" });
    expect(p.anterior.inicio).toBe("2025-12-01");
    expect(p.anterior.fimExclusivo).toBe("2026-01-01");
  });
});
