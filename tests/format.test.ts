import { describe, expect, it } from "vitest";

import {
  adicionarDiasISO,
  dataAdiadaISO,
  formatarMoeda,
  formatarMoedaCurta,
  inicioMesISO,
  inicioProximoMesISO,
  normalizarNome,
  parseMoedaBR,
} from "@/lib/format";

describe("moeda", () => {
  it("formata em BRL", () => {
    expect(formatarMoeda(1234567.89).replace(/ /g, " ")).toBe("R$ 1.234.567,89");
    expect(formatarMoeda(null).replace(/ /g, " ")).toBe("R$ 0,00");
  });

  it("formata curto em mil e mi", () => {
    expect(formatarMoedaCurta(891_000)).toBe("R$ 891 mil");
    expect(formatarMoedaCurta(1_140_000)).toBe("R$ 1,14 mi");
    expect(formatarMoedaCurta(7_000_000)).toBe("R$ 7 mi");
    expect(formatarMoedaCurta(0)).toBe("R$ 0");
  });

  it("interpreta texto em pt-BR", () => {
    expect(parseMoedaBR("R$ 1.234,56")).toBe(1234.56);
    expect(parseMoedaBR("50")).toBe(50);
    expect(parseMoedaBR("")).toBe(0);
    expect(parseMoedaBR("abc")).toBeNull();
  });

  it("não confunde ponto decimal de String(numero) com milhar", () => {
    expect(parseMoedaBR("16259.44")).toBe(16259.44);
    expect(parseMoedaBR("1.5")).toBe(1.5);
    expect(parseMoedaBR("16.000")).toBe(16000);
    expect(parseMoedaBR("16.259,44")).toBe(16259.44);
    expect(parseMoedaBR("1.234.567,89")).toBe(1234567.89);
    expect(parseMoedaBR("16000,00")).toBe(16000);
  });

  it("pré-preenchimento formatado volta ao mesmo número", () => {
    const texto = formatarMoeda(16259.44).replace(/^R\$\s?/, "");
    expect(parseMoedaBR(texto)).toBe(16259.44);
  });
});

describe("datas", () => {
  it("soma dias em calendário", () => {
    expect(adicionarDiasISO("2026-01-31", 1)).toBe("2026-02-01");
    expect(adicionarDiasISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("calcula início do mês e do próximo", () => {
    expect(inicioMesISO("2026-09-19")).toBe("2026-09-01");
    expect(inicioProximoMesISO("2026-12-05")).toBe("2027-01-01");
  });

  it("adia ação atrasada para o dia seguinte a hoje", () => {
    expect(dataAdiadaISO("2026-09-25", 1, "2026-09-30")).toBe("2026-10-01");
  });

  it("adia ação de hoje para amanhã", () => {
    expect(dataAdiadaISO("2026-09-30", 1, "2026-09-30")).toBe("2026-10-01");
  });

  it("adia ação futura a partir da própria data", () => {
    expect(dataAdiadaISO("2026-10-10", 1, "2026-09-30")).toBe("2026-10-11");
  });
});

describe("normalizarNome", () => {
  it("ignora acento, caixa e espaços duplos", () => {
    expect(normalizarNome("  Construtora   JÔ Ltda ")).toBe("construtora jo ltda");
  });
});
