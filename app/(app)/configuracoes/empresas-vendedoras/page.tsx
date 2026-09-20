import { EmitentesConfigClient } from "@/components/crm/emitentes-config-client";
import { listarEmitentesConfig } from "@/lib/actions/emitentes";

export default async function EmpresasVendedorasPage() {
  const empresas = await listarEmitentesConfig();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Empresas vendedoras</h2>
        <p className="text-sm text-muted-foreground">
          Empresas do grupo que emitem as propostas: dados do cabeçalho, logo,
          numeração do orçamento. Cada negociação, produto e meta pertence a uma
          delas. Só o diretor da empresa edita; qualquer diretor pode criar uma nova.
        </p>
      </div>
      <EmitentesConfigClient empresas={empresas} />
    </div>
  );
}
