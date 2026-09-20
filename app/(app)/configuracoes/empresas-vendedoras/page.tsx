import { EmitentesConfigClient } from "@/components/crm/emitentes-config-client";
import { listarEmitentesConfig } from "@/lib/actions/emitentes";
import { Secao } from "@/components/crm/pagina";

export default async function EmpresasVendedorasPage() {
  const empresas = await listarEmitentesConfig();

  return (
    <Secao titulo="Empresas vendedoras">
      <p className="mb-4 text-sm text-muted-foreground">
        Empresas do grupo que emitem as propostas: dados do cabeçalho, logo,
        numeração do orçamento. Cada negociação, produto e meta pertence a uma
        delas. Só o diretor da empresa edita; qualquer diretor pode criar uma
        nova.
      </p>
      <EmitentesConfigClient empresas={empresas} />
    </Secao>
  );
}
