import { Suspense } from "react";

import { BotaoExportar } from "@/components/crm/botao-exportar";
import { ProdutosFiltroBusca } from "@/components/crm/produtos-filtro-busca";

type SearchParams = Promise<{ q?: string | string[] }>;

function paramUnico(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

/** Shell mínimo com exportação (CRUD completo na etapa de orçamento/produtos). */
export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = paramUnico(sp.q) ?? "";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Produtos</h1>
        <BotaoExportar tela="produtos" filtros={{ q: q || null }} />
      </header>
      <Suspense fallback={null}>
        <ProdutosFiltroBusca valorInicial={q} />
      </Suspense>
      <p className="mt-4 text-sm text-muted-foreground">
        Use Exportar Excel para baixar o catálogo filtrado. O CRUD completo
        chega na etapa de orçamento.
      </p>
import { ProdutosConfigClient } from "@/components/crm/produtos-config-client";
import { listarListasPorTipo, listarProdutos } from "@/lib/actions/config";

export default async function ProdutosConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [produtos, linhas] = await Promise.all([
    listarProdutos(q),
    listarListasPorTipo("linha"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Produtos</h2>
        <p className="text-sm text-muted-foreground">
          Cadastro simples para orçamentos (código, nome, linha, preço base).
        </p>
      </div>
      <ProdutosConfigClient
        initial={produtos}
        linhas={linhas.filter((l) => l.ativo).map((l) => l.valor)}
        buscaInicial={q ?? ""}
      />
    </div>
  );
}
