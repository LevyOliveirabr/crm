import { describe, expect, it } from "vitest";

import { htmlLembreteVendedor, htmlResumoDiretor } from "@/lib/lembrete-diario";

const acao = (over: Partial<Parameters<typeof htmlLembreteVendedor>[0]["atrasadas"][number]> = {}) => ({
  id: "a1",
  descricao: "Ligar para o comprador",
  tipo: "ligar",
  data: "2026-09-18",
  responsavelId: "u1",
  negociacaoId: "n1",
  negociacaoTitulo: "Zopone | PPP",
  empresaNome: "Zopone <Engenharia>",
  emitenteNome: null,
  valor: 758000,
  atrasada: true,
  ...over,
});

describe("lembrete diário", () => {
  it("monta assunto com contagens e escapa HTML", () => {
    const msg = htmlLembreteVendedor(
      {
        id: "u1",
        nome: "Levy Oliveira",
        email: "levy@x.com",
        diretor: false,
        atrasadas: [acao()],
        deHoje: [acao({ id: "a2", data: "2026-09-19", atrasada: false })],
        semAcao: 2,
      },
      "2026-09-19",
    );
    expect(msg.subject).toContain("1 atrasada(s), 1 para hoje");
    expect(msg.html).toContain("Zopone &lt;Engenharia&gt;");
    expect(msg.html).not.toContain("<Engenharia>");
    expect(msg.html).toContain("/negociacoes/n1");
    expect(msg.text).toContain("[ATRASADA 18/09/2026]");
  });

  it("resumo do diretor lista cada vendedor", () => {
    const msg = htmlResumoDiretor({
      hoje: "2026-09-19",
      usuarios: [
        { id: "u1", nome: "Ana", email: "a@x.com", diretor: false, atrasadas: [acao()], deHoje: [], semAcao: 0 },
        { id: "u2", nome: "Bia", email: "b@x.com", diretor: false, atrasadas: [], deHoje: [], semAcao: 3 },
      ],
    });
    expect(msg.subject).toContain("1 atrasada(s)");
    expect(msg.html).toContain("Ana");
    expect(msg.html).toContain("Bia");
    expect(msg.text).toContain("Bia: 0 atrasadas, 0 hoje, 3 sem ação");
  });
});
