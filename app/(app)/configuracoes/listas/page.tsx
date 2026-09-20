import { ListasConfigClient } from "@/components/crm/listas-config-client";
import { listarListasPorTipo } from "@/lib/actions/config";
import type { Database } from "@/lib/database.types";
import { Secao } from "@/components/crm/pagina";

type TipoLista = Database["public"]["Enums"]["tipo_lista"];

export default async function ListasConfigPage() {
  const tipos: TipoLista[] = ["segmento", "linha", "origem", "motivo_perda"];
  const initial = Object.fromEntries(
    await Promise.all(
      tipos.map(async (t) => [t, await listarListasPorTipo(t)] as const),
    ),
  ) as Record<TipoLista, Awaited<ReturnType<typeof listarListasPorTipo>>>;

  return (
    <Secao titulo="Listas">
      <p className="mb-4 text-sm text-muted-foreground">
        Segmentos, linhas, origens e motivos de perda.
      </p>
      <ListasConfigClient initial={initial} />
    </Secao>
  );
}
