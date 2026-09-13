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
    </div>
  );
}
