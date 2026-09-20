import { FunisConfigClient } from "@/components/crm/funis-config-client";
import { listarFunisComEtapas } from "@/lib/actions/config";
import { Secao } from "@/components/crm/pagina";

export default async function FunisConfigPage() {
  const funis = await listarFunisComEtapas();

  return (
    <Secao titulo="Funis e etapas">
      <p className="mb-4 text-sm text-muted-foreground">
        Arraste para reordenar. Não dá para desativar etapa com negociações
        abertas sem movê-las.
      </p>
      <FunisConfigClient initial={funis} />
    </Secao>
  );
}
