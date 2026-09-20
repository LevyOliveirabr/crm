import { MetasConfigClient } from "@/components/crm/metas-config-client";
import { listarMetasAno } from "@/lib/actions/metas";
import { hojeISO } from "@/lib/format";

type SearchParams = Promise<{ ano?: string | string[]; empresa?: string | string[] }>;

export default async function MetasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const anoParam = Array.isArray(sp.ano) ? sp.ano[0] : sp.ano;
  const anoAtual = Number(hojeISO().slice(0, 4));
  const ano =
    anoParam && /^\d{4}$/.test(anoParam) ? Number(anoParam) : anoAtual;

  const empresaParam = Array.isArray(sp.empresa) ? sp.empresa[0] : sp.empresa;
  const dados = await listarMetasAno(ano, empresaParam ?? null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Metas</h2>
        <p className="text-sm text-muted-foreground">
          Meta mensal de vendas por vendedor em cada empresa vendedora. Clique
          na célula, digite o valor e saia do campo para salvar.
        </p>
      </div>
      {dados ? (
        <MetasConfigClient dados={dados} />
      ) : (
        <p className="text-sm text-muted-foreground">Apenas o diretor acessa esta tela.</p>
      )}
    </div>
  );
}
