import { beforeEach, describe, expect, it, vi } from "vitest";

import { nextSeguro } from "@/lib/auth-redirect";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession },
  }),
}));

import { GET } from "@/app/auth/callback/route";

function local(destino: string) {
  return `http://localhost:3000${destino}`;
}

describe("nextSeguro", () => {
  it("aceita caminhos internos", () => {
    expect(nextSeguro("/hoje")).toBe("/hoje");
    expect(nextSeguro("/negociacoes/abc?x=1")).toBe("/negociacoes/abc?x=1");
  });

  it("rejeita destinos externos e vazios", () => {
    expect(nextSeguro("https://evil.com")).toBe("/hoje");
    expect(nextSeguro("//evil.com")).toBe("/hoje");
    expect(nextSeguro("/\\evil.com")).toBe("/hoje");
    expect(nextSeguro("")).toBe("/hoje");
    expect(nextSeguro(null)).toBe("/hoje");
    expect(nextSeguro(undefined, "/auth/definir-senha")).toBe(
      "/auth/definir-senha",
    );
  });
});

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("troca o code e redireciona para o next do Google", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      new Request(local("/auth/callback?code=abc&next=%2Fhoje")),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe(local("/hoje"));
  });

  it("sem next, mantém o destino de convite/recovery", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(new Request(local("/auth/callback?code=abc")));
    expect(res.headers.get("location")).toBe(local("/auth/definir-senha"));
  });

  it("ignora next externo (open redirect)", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      new Request(
        local("/auth/callback?code=abc&next=https%3A%2F%2Fevil.com"),
      ),
    );
    expect(res.headers.get("location")).toBe(local("/auth/definir-senha"));
  });

  it("Google recusado pelo Supabase volta para /login?erro=google", async () => {
    const res = await GET(
      new Request(
        local(
          "/auth/callback?next=%2Fhoje&error=access_denied&error_description=Signups+not+allowed",
        ),
      ),
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(local("/login?erro=google"));
  });

  it("falha na troca do code em fluxo Google usa erro=google", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid" },
    });
    const res = await GET(
      new Request(local("/auth/callback?code=abc&next=%2Fhoje")),
    );
    expect(res.headers.get("location")).toBe(local("/login?erro=google"));
  });

  it("falha na troca do code em fluxo de convite usa erro=convite", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid" },
    });
    const res = await GET(new Request(local("/auth/callback?code=abc")));
    expect(res.headers.get("location")).toBe(local("/login?erro=convite"));
  });
});
