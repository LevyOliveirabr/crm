import { ParametrosForm } from "@/components/crm/parametros-form";
import { obterParametros } from "@/lib/actions/config";

export default async function ParametrosPage() {
  const params = await obterParametros();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Parâmetros</h2>
        <p className="text-sm text-muted-foreground">
          Dias de parada, pesos da previsão, alerta de validade e prefixo do
          orçamento.
        </p>
      </div>
      <ParametrosForm initial={params} />
    </div>
  );
}
