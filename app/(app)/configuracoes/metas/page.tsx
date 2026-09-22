import { MetasConfigClient } from "@/components/crm/metas-config-client";
import { listarMetasAno } from "@/lib/actions/metas";
import { hojeISO } from "@/lib/format";
import { EstadoVazio, Secao } from "@/components/crm/pagina";

type SearchParams = Promise<{
  ano?: string | string[];
  empresa?: string | string[];
  tipo?: string | string[];
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
  const tipoParam = Array.isArray(sp.tipo) ? sp.tipo[0] : sp.tipo;
  const tipo = tipoParam === "pipeline" ? "pipeline" : "faturamento";
  const dados = await listarMetasAno(ano, empresaParam ?? null, tipo);

  return (
    <Secao titulo="Metas">
      <p className="mb-4 text-sm text-muted-foreground">
        Meta por pessoa, por empresa e por mês. A meta da equipe é a soma das
        pessoas — não se digita um total à parte. Quem também vende vê a própria
        linha e o total embaixo. Use “Pipeline” para a meta de negócios novos.
      </p>
      {dados ? (
        <MetasConfigClient dados={dados} />
      ) : (
        <EstadoVazio texto="Apenas o diretor acessa esta tela." compacto />
      )}
    </Secao>
  );
}
