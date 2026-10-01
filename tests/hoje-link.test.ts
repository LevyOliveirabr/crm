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

import { HojeInterativo } from "@/components/crm/hoje-interativo";

const acao = {
  id: "acao-1",
  descricao: "Ligar para o comprador",
  tipo: "ligar" as const,
  data: "2026-09-30",
  negociacaoId: "neg-42",
  empresaNome: "Remo Engenharia",
  atrasada: false,
};

describe("tarefas de Meu dia", () => {
  it("liga a descrição da tarefa à ficha da negociação", () => {
    const html = renderToStaticMarkup(
      createElement(HojeInterativo, {
        atrasadas: [
          {
            ...acao,
            id: "acao-atrasada",
            negociacaoId: "neg-atrasada",
            atrasada: true,
            descricao: "Retomar proposta",
          },
        ],
        deHoje: [acao],
        semAcao: [],
      }),
    );

    expect(html).toContain(
      '<a href="/negociacoes/neg-42" class="block truncate text-sm font-medium hover:underline">Ligar para o comprador</a>',
    );
    expect(html).toContain(
      '<a href="/negociacoes/neg-atrasada" class="block truncate text-sm font-medium hover:underline">Retomar proposta</a>',
    );
    expect(html).toContain("Adiar 1 dia");
    expect(html).toContain("Concluir");
  });
});
