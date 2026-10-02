import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children?: ReactNode;
  }) => createElement("a", { href, className }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

import { NegociacaoFicha } from "@/components/crm/negociacao-ficha";

const negociacao = {
  id: "neg-1",
  titulo: "[Iluminação industrial] Metro SP - Linha 15",
  empresaId: "emp-1",
  empresaNome: "Metro SP",
  emitenteId: null,
  emitenteNome: null,
  valorEstimado: 1000,
  valorPrevisao: null,
  negocioUnico: true,
  temperatura: 2,
  responsavelId: "usr-1",
  responsavelNome: "Ana",
  linha: "Iluminação industrial",
  origem: null,
  previsaoMes: null,
  previsaoData: null,
  dataFaturamento: null,
  categoriaForecast: null,
  status: "aberta" as const,
  valorFinal: null,
  motivoPerda: null,
  anotacaoFechamento: null,
  fechadoEm: null,
  etapaId: "et-1",
  funilId: "funil-1",
  contatoId: null,
};

function acao(
  id: string,
  descricao: string,
  data: string,
) {
  return {
    id,
    descricao,
    tipo: "ligar" as const,
    data,
    concluidaEm: null,
    criadoEm: "2026-01-01T12:00:00Z",
  };
}

describe("próxima ação na ficha", () => {
  it("lista todas as ações abertas, com atraso só na que já venceu", () => {
    const html = renderToStaticMarkup(
      createElement(NegociacaoFicha, {
        negociacao,
        etapas: [{ id: "et-1", nome: "Proposta", ordem: 1 }],
        acoesAbertas: [
          acao("a1", "Enviar memorial", "2020-01-15"),
          acao("a2", "Confirmar visita na linha 15", "2099-06-01"),
        ],
        acoesConcluidas: [],
        interacoes: [],
        orcamentos: [],
        contatos: [],
        linhas: [],
        origens: [],
        motivosPerda: [],
        vendedores: [],
        isDiretor: false,
      }),
    );

    expect(html).toContain("Enviar memorial");
    expect(html).toContain("Confirmar visita na linha 15");
    expect(html).toContain("atrasada");
    expect(html.split("atrasada").length - 1).toBe(1);
    expect(html.split(">Concluir<").length - 1).toBe(2);
    expect(html).not.toContain("Nenhuma ação pendente");
  });
});
