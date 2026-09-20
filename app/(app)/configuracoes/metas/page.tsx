import { MetasConfigClient } from "@/components/crm/metas-config-client";
import { listarMetasAno } from "@/lib/actions/metas";
import { hojeISO } from "@/lib/format";
import { EstadoVazio, Secao } from "@/components/crm/pagina";

type SearchParams = Promise<{
  ano?: string | string[];
  empresa?: string | string[];
}>;

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
    <Secao titulo="Metas">
      <p className="mb-4 text-sm text-muted-foreground">
        Meta mensal de vendas por vendedor em cada empresa vendedora. Clique na
        célula, digite o valor e saia do campo para salvar.
      </p>
      {dados ? (
        <MetasConfigClient dados={dados} />
      ) : (
        <EstadoVazio texto="Apenas o diretor acessa esta tela." compacto />
      )}
    </Secao>
  );
}
