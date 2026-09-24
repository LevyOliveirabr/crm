import { describe, expect, it } from "vitest";

import { aplicarColagemHtml, htmlParaTexto } from "@/lib/html-para-texto";
import { interacaoSchema } from "@/lib/schemas/interacao";

describe("htmlParaTexto", () => {
  it("separa parágrafos de um e-mail em divs, como o Gmail", () => {
    const html =
      '<div dir="ltr"><div>Olá, Levy.</div><div><br></div><div>Segue a proposta em anexo.</div><div><br></div><div>Abraço,<br>Ana</div></div>';

    expect(htmlParaTexto(html)).toBe(
      "Olá, Levy.\n\nSegue a proposta em anexo.\n\nAbraço,\nAna",
    );
  });

  it("separa parágrafos em <p>, como o Outlook", () => {
    const html =
      "<html><body><p>Primeiro parágrafo.</p><p>Segundo parágrafo.</p></body></html>";

    expect(htmlParaTexto(html)).toBe(
      "Primeiro parágrafo.\n\nSegundo parágrafo.",
    );
  });

  it("mantém itens de lista em linhas separadas e ignora script", () => {
    const html =
      "<ul><li>Um &amp; dois</li><li>Três</li></ul><script>alert(1)</script>";

    expect(htmlParaTexto(html)).toBe("Um & dois\nTrês");
  });

  it("não deixa mais de uma linha em branco entre blocos", () => {
    const html = "<div>A</div><div><br></div><div><br></div><div>B</div>";

    expect(htmlParaTexto(html)).toBe("A\n\nB");
  });
});

describe("aplicarColagemHtml", () => {
  it("insere o texto formatado na seleção", () => {
    const res = aplicarColagemHtml(
      "antes |fim",
      6,
      7,
      "<p>linha 1</p><p>linha 2</p>",
    );

    expect(res).toEqual({
      texto: "antes linha 1\n\nlinha 2fim",
      cursor: "antes linha 1\n\nlinha 2".length,
    });
  });

  it("deixa a colagem padrão quando não há HTML", () => {
    expect(aplicarColagemHtml("atual", 0, 0, "   ")).toBeNull();
  });
});

describe("interacaoSchema texto", () => {
  it("tira espaço só nas pontas e mantém o parágrafo do meio", () => {
    const parsed = interacaoSchema.parse({
      negociacao_id: "00000000-0000-4000-8000-000000000001",
      tipo: "anotacao",
      texto: "  Olá.\n\nSegue a proposta.\n",
    });

    expect(parsed.texto).toBe("Olá.\n\nSegue a proposta.");
  });
});
