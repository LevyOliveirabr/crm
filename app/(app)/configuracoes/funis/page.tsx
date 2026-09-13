import { FunisConfigClient } from "@/components/crm/funis-config-client";
import { listarFunisComEtapas } from "@/lib/actions/config";

export default async function FunisConfigPage() {
  const funis = await listarFunisComEtapas();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Funis e etapas</h2>
        <p className="text-sm text-muted-foreground">
          Arraste para reordenar. Não dá para desativar etapa com negociações
          abertas sem movê-las.
        </p>
      </div>
      <FunisConfigClient initial={funis} />
    </div>
  );
}
