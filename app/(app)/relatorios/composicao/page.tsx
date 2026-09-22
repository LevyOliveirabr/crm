import Link from "next/link";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  idsEquipeVisivel,
  listarVendedoresVisiveis,
  podeVerEquipe,
  resolverFiltroVendedor,
} from "@/lib/auth/equipe";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { formatarData, formatarMoeda } from "@/lib/format";
import { listarComposicaoRelatorio } from "@/lib/relatorios/dados";
import { resolverPeriodo } from "@/lib/relatorios/periodo";
import { createClient } from "@/lib/supabase/server";
import { Pagina, PaginaCabecalho } from "@/components/crm/pagina";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function paramUnico(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export default async function ComposicaoRelatorioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const sp = await searchParams;
  const tipo = paramUnico(sp.tipo) === "abertas" ? "abertas" : "vendidas";
  const responsavel = paramUnico(sp.responsavel) ?? null;

  const periodo = resolverPeriodo({
    tipo: paramUnico(sp.periodo),
    mes: paramUnico(sp.mes),
    de: paramUnico(sp.de),
    ate: paramUnico(sp.ate),
  });

  const escopo = await getEscopoEmpresa(usuario, sp);
  const isDiretor = podeVerEquipe(usuario, escopo);
  const supabase = await createClient();
  const vendedores = await listarVendedoresVisiveis(supabase, usuario, escopo);
  const vendedorFiltro = resolverFiltroVendedor(
    usuario,
    vendedores,
    paramUnico(sp.vendedor),
    escopo,
  );

  const itens = await listarComposicaoRelatorio(
    supabase,
    {
      periodo,
      vendedorId: vendedorFiltro,
      linha: paramUnico(sp.linha) ?? null,
      origem: paramUnico(sp.origem) ?? null,
      isDiretor,
      equipeIds: idsEquipeVisivel(usuario, vendedores, escopo),
      emitenteId: escopo.emitenteId,
      emitenteNome: escopo.emitente?.nome ?? null,
    },
    tipo,
    responsavel,
  );

  const total = itens.reduce((s, n) => s + n.valor, 0);
  const titulo =
    tipo === "vendidas"
      ? "Vendas que formam o número"
      : "Negociações em aberto que formam o número";

  const voltar = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = paramUnico(v);
    if (!val || k === "tipo" || k === "responsavel") continue;
    voltar.set(k, val);
  }
  const voltarHref = `/relatorios${voltar.toString() ? `?${voltar}` : ""}`;

  return (
    <Pagina>
      <PaginaCabecalho
        voltar={{ href: voltarHref, label: "Relatórios" }}
        titulo={titulo}
        subtitulo={
          itens.length === 0
            ? "Nenhuma negociação nesta conta"
            : `${itens.length} ${itens.length === 1 ? "negociação" : "negociações"} · ${formatarMoeda(total)}`
        }
        descricao={
          tipo === "vendidas"
            ? `Vendas com fechamento em ${periodo.rotulo}. A soma dos valores é o vendido deste recorte e o ticket é essa soma dividida pela quantidade.`
            : "Negociações ainda em andamento deste recorte. A soma dos valores estimados é o aberto."
        }
      />

      {itens.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted-foreground">
          Não há negociação nesta conta.
        </p>
      ) : (
        <ul className="card-surface divide-y divide-border">
          {itens.map((n) => (
            <li key={n.id}>
              <Link
                href={`/negociacoes/${n.id}`}
                className="flex flex-col gap-0.5 px-4 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="font-medium">{n.empresaNome}</span>
                  <span className="text-muted-foreground"> — {n.titulo}</span>
                  <span className="block text-xs text-muted-foreground">
                    {n.responsavelNome}
                    {n.referencia
                      ? tipo === "vendidas"
                        ? ` · ${formatarData(n.referencia)}`
                        : ` · ${n.referencia}`
                      : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatarMoeda(n.valor)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}
