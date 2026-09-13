import { Suspense } from "react";

import { RelatoriosExportacao } from "@/components/crm/relatorios-exportacao";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { inicioMesAtualISO } from "@/lib/format";

type SearchParams = Promise<{
  aba?: string | string[];
  mes?: string | string[];
  vendedor?: string | string[];
  linha?: string | string[];
  origem?: string | string[];
}>;

function paramUnico(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

/**
 * Shell mínimo das abas de Relatórios com botão Exportar Excel por aba
 * (UI completa na etapa de Relatórios).
 */
export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const sp = await searchParams;
  const aba = paramUnico(sp.aba) ?? "presidencia";
  const mes = paramUnico(sp.mes) ?? inicioMesAtualISO();
  const vendedor =
    usuario.perfil === "diretor" ? paramUnico(sp.vendedor) : undefined;
  const linha = paramUnico(sp.linha);
  const origem = paramUnico(sp.origem);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Relatórios</h1>
      </header>
      <Suspense fallback={null}>
        <RelatoriosExportacao
          aba={aba}
          mes={mes}
          vendedor={vendedor ?? null}
          linha={linha ?? null}
          origem={origem ?? null}
          isDiretor={usuario.perfil === "diretor"}
        />
      </Suspense>
      <p className="mt-4 text-sm text-muted-foreground">
        Cada aba exporta os dados filtrados em Excel. Os gráficos e o layout
        imprimível chegam na etapa de Relatórios.
      </p>
    </div>
  );
}
