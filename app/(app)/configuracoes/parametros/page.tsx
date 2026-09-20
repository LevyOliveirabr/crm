import { ParametrosForm } from "@/components/crm/parametros-form";
import { obterParametros } from "@/lib/actions/config";
import { Secao } from "@/components/crm/pagina";

export default async function ParametrosPage() {
  const params = await obterParametros();

  return (
    <Secao titulo="Parâmetros">
      <p className="mb-4 text-sm text-muted-foreground">
        Dias de parada, pesos da previsão e alerta de validade. O prefixo e a
        numeração do orçamento ficam em Empresas vendedoras.
      </p>
      <ParametrosForm initial={params} />
    </Secao>
  );
}
