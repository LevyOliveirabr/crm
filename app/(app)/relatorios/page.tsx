import { Suspense } from "react";

import {
  RelatoriosClient,
  type AbaRelatorio,
} from "@/components/crm/relatorios-client";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  idsEquipeVisivel,
  listarVendedoresVisiveis,
  podeVerEquipe,
  resolverFiltroVendedor,
} from "@/lib/auth/equipe";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { carregarDadosRelatorios } from "@/lib/relatorios/dados";
import { resolverPeriodo, type TipoPeriodo } from "@/lib/relatorios/periodo";
import { createClient } from "@/lib/supabase/server";
import { inicioMesAtualISO, hojeISO } from "@/lib/format";

type SearchParams = Promise<{
  emitente?: string | string[];
  aba?: string | string[];
  periodo?: string | string[];
  mes?: string | string[];
  de?: string | string[];
  ate?: string | string[];
  vendedor?: string | string[];
  linha?: string | string[];
  origem?: string | string[];
}>;

function paramUnico(
  valor: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

const ABAS: AbaRelatorio[] = [
  "presidencia",
  "funil",
  "previsao",
  "ranking",
  "perdas",
  "carteira",
];

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const sp = await searchParams;
  const periodoTipo = paramUnico(sp.periodo);
  const mesParam = paramUnico(sp.mes);
  const deParam = paramUnico(sp.de);
  const ateParam = paramUnico(sp.ate);
  const vendedorParam = paramUnico(sp.vendedor);
  const linhaParam = paramUnico(sp.linha);
  const origemParam = paramUnico(sp.origem);
  const abaParam = paramUnico(sp.aba);

  const escopo = await getEscopoEmpresa(usuario, sp);
  const isDiretor = podeVerEquipe(usuario, escopo);
  let abaInicial = (ABAS.includes(abaParam as AbaRelatorio)
    ? abaParam
    : "presidencia") as AbaRelatorio;
  if (abaInicial === "ranking" && !isDiretor) {
    abaInicial = "presidencia";
  }

  const periodo = resolverPeriodo({
    tipo: periodoTipo,
    mes: mesParam,
    de: deParam,
    ate: ateParam,
  });

  const supabase = await createClient();
  const vendedores = await listarVendedoresVisiveis(supabase, usuario, escopo);
  const filtrarVendedor = resolverFiltroVendedor(usuario, vendedores, vendedorParam, escopo);
  const equipeIds = idsEquipeVisivel(usuario, vendedores, escopo);

  const [{ data: linhasRaw }, { data: origensRaw }, dados] =
    await Promise.all([
      supabase
        .from("listas")
        .select("valor")
        .eq("tipo", "linha")
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
      supabase
        .from("listas")
        .select("valor")
        .eq("tipo", "origem")
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
      carregarDadosRelatorios(supabase, {
        periodo,
        vendedorId: filtrarVendedor,
        linha: linhaParam ?? null,
        origem: origemParam ?? null,
        isDiretor,
        equipeIds,
        emitenteId: escopo.emitenteId,
        emitenteNome: escopo.emitente?.nome ?? null,
      }),
    ]);

  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">Carregando relatórios…</div>
      }
    >
      <RelatoriosClient
        dados={dados}
        isDiretor={isDiretor}
        vendedores={vendedores}
        linhasOpcoes={(linhasRaw ?? []).map((l) => l.valor)}
        origensOpcoes={(origensRaw ?? []).map((o) => o.valor)}
        abaInicial={abaInicial}
        filtros={{
          periodo: periodo.tipo as TipoPeriodo,
          mes: mesParam ? periodo.meses[0] ?? inicioMesAtualISO() : periodo.meses[0] ?? inicioMesAtualISO(),
          de: deParam ?? periodo.inicio,
          ate: ateParam ?? (periodo.tipo === "personalizado" ? periodo.fimInclusivo : hojeISO()),
          vendedor: filtrarVendedor,
          linha: linhaParam ?? null,
          origem: origemParam ?? null,
          rotuloPeriodo: periodo.rotulo,
        }}
      />
    </Suspense>
  );
}
