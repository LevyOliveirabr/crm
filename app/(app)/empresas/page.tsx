import { Suspense } from "react";

import { BotaoExportar } from "@/components/crm/botao-exportar";
import { EmpresasFiltroBusca } from "@/components/crm/empresas-filtro-busca";

type SearchParams = Promise<{ q?: string | string[]; vendedor?: string | string[] }>;

function paramUnico(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

/** Shell mínimo com exportação (lista completa fica na etapa de Empresas). */
export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = paramUnico(sp.q) ?? "";
  const vendedor = paramUnico(sp.vendedor);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Empresas</h1>
        <BotaoExportar
          tela="empresas"
          filtros={{ q: q || null, vendedor }}
        />
      </header>
      <Suspense fallback={null}>
        <EmpresasFiltroBusca valorInicial={q} />
      </Suspense>
      <p className="mt-4 text-sm text-muted-foreground">
        Use Exportar Excel para baixar todas as empresas com os filtros atuais
        (sem paginação). A listagem completa chega na etapa de Empresas.
      </p>
    </div>
  );
}
