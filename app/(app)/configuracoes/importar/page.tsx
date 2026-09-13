import { ImportarClient } from "@/components/crm/importar-client";

export default function ImportarPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Importar CSV</h2>
        <p className="text-sm text-muted-foreground">
          Prévia das 5 primeiras linhas com mapeamento de colunas, depois
          confirmação e relatório.
        </p>
      </div>
      <ImportarClient />
    </div>
  );
}
