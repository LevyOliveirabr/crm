import { ImportarClient } from "@/components/crm/importar-client";
import { Secao } from "@/components/crm/pagina";

export default function ImportarPage() {
  return (
    <Secao titulo="Importar CSV">
      <p className="mb-4 text-sm text-muted-foreground">
        Prévia das 5 primeiras linhas com mapeamento de colunas, depois
        confirmação e relatório.
      </p>
      <ImportarClient />
    </Secao>
  );
}
