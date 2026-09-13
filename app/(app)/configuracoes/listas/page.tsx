import { ListasConfigClient } from "@/components/crm/listas-config-client";
import { listarListasPorTipo } from "@/lib/actions/config";
import type { Database } from "@/lib/database.types";

type TipoLista = Database["public"]["Enums"]["tipo_lista"];

export default async function ListasConfigPage() {
  const tipos: TipoLista[] = [
    "segmento",
    "linha",
    "origem",
    "motivo_perda",
  ];
  const initial = Object.fromEntries(
    await Promise.all(
      tipos.map(async (t) => [t, await listarListasPorTipo(t)] as const),
    ),
  ) as Record<TipoLista, Awaited<ReturnType<typeof listarListasPorTipo>>>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Listas</h2>
        <p className="text-sm text-muted-foreground">
          Segmentos, linhas, origens e motivos de perda.
        </p>
      </div>
      <ListasConfigClient initial={initial} />
    </div>
  );
}
