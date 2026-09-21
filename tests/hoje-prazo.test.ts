import { describe, expect, it } from "vitest";

import { isPrazoHojeId, PRAZOS_HOJE } from "@/lib/hoje-prazo";

describe("hoje-prazo", () => {
  it("lista ids estáveis usados na URL", () => {
    expect(PRAZOS_HOJE.map((p) => p.id)).toEqual([
      "hoje",
      "ontem",
      "amanha",
      "7atras",
      "7frente",
      "30frente",
      "custom",
    ]);
  });

  it("valida ids conhecidos", () => {
    expect(isPrazoHojeId("hoje")).toBe(true);
    expect(isPrazoHojeId("custom")).toBe(true);
    expect(isPrazoHojeId("foo")).toBe(false);
    expect(isPrazoHojeId(undefined)).toBe(false);
  });
});
