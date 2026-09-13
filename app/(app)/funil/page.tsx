import { Suspense } from "react";

import { FunilClient } from "@/components/crm/funil-client";
import type { CartaoNegociacaoData } from "@/components/crm/cartao-negociacao";
import type { EtapaColuna } from "@/components/crm/funil-kanban";
import type { LinhaLista } from "@/components/crm/funil-lista";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  funil?: string | string[];
  vendedor?: string | string[];
  linha?: string | string[];
  temperatura?: string | string[];
  q?: string | string[];
  vista?: string | string[];
}>;

function paramUnico(
  valor: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export default async function FunilPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const sp = await searchParams;
  const funilParam = paramUnico(sp.funil);
  const vendedorParam = paramUnico(sp.vendedor);
  const linhaParam = paramUnico(sp.linha);
  const temperaturaParam = paramUnico(sp.temperatura);
  const qParam = (paramUnico(sp.q) ?? "").trim();
  const vistaParam = paramUnico(sp.vista);
  const vista = vistaParam === "lista" ? "lista" : "kanban";

  const filtrarVendedor =
    usuario.perfil === "diretor" && vendedorParam ? vendedorParam : null;

  const supabase = await createClient();

  const [{ data: funisRaw }, { data: linhasRaw }, { data: vendedores }] =
    await Promise.all([
      supabase
        .from("funis")
        .select("id, nome, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
      supabase
        .from("listas")
        .select("valor")
        .eq("tipo", "linha")
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
      usuario.perfil === "diretor"
        ? supabase
            .from("usuarios")
            .select("id, nome")
            .eq("ativo", true)
            .order("nome")
        : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    ]);

  const funis = funisRaw ?? [];
  if (funis.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight">Funil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhum funil ativo cadastrado.
        </p>
      </div>
    );
  }

  const funilId =
    funis.find((f) => f.id === funilParam)?.id ?? funis[0]!.id;

  const [{ data: etapasRaw }, { data: funilAgg }, { data: negRaw }] =
    await Promise.all([
      supabase
        .from("etapas")
        .select("id, nome, ordem")
        .eq("funil_id", funilId)
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
      supabase
        .from("v_funil")
        .select("etapa_id, qtd, valor")
        .eq("funil_id", funilId),
      (() => {
        let query = supabase
          .from("v_negociacoes")
          .select(
            `
            id,
            titulo,
            empresa_nome,
            valor_estimado,
            temperatura,
            dias_na_etapa,
            proxima_acao_descricao,
            proxima_acao_data,
            acao_atrasada,
            sem_acao,
            parada,
            etapa_id,
            etapa_nome,
            responsavel_nome,
            responsavel_id,
            linha
          `,
          )
          .eq("status", "aberta")
          .eq("funil_id", funilId)
          .order("atualizado_em", { ascending: false });

        if (filtrarVendedor) {
          query = query.eq("responsavel_id", filtrarVendedor);
        }
        if (linhaParam) {
          query = query.eq("linha", linhaParam);
        }
        if (temperaturaParam === "1" || temperaturaParam === "2" || temperaturaParam === "3") {
          query = query.eq("temperatura", Number(temperaturaParam));
        }
        return query;
      })(),
    ]);

  const aggByEtapa = new Map(
    (funilAgg ?? []).map((r) => [
      r.etapa_id!,
      { qtd: Number(r.qtd ?? 0), valor: Number(r.valor ?? 0) },
    ]),
  );

  // Com filtros de UI, recalcula soma da coluna a partir dos cartões filtrados
  // (sem filtro, bate com v_funil; com filtro, reflete o recorte).
  let negociacoes: CartaoNegociacaoData[] = (negRaw ?? [])
    .filter((n) => n.id && n.etapa_id)
    .map((n) => ({
      id: n.id!,
      titulo: n.titulo ?? "Sem título",
      empresaNome: n.empresa_nome ?? "—",
      valorEstimado: Number(n.valor_estimado ?? 0),
      temperatura: Number(n.temperatura ?? 2),
      diasNaEtapa: Number(n.dias_na_etapa ?? 0),
      proximaAcaoDescricao: n.proxima_acao_descricao,
      proximaAcaoData: n.proxima_acao_data,
      acaoAtrasada: Boolean(n.acao_atrasada),
      semAcao: Boolean(n.sem_acao),
      parada: Boolean(n.parada),
      etapaId: n.etapa_id!,
      responsavelNome: n.responsavel_nome,
    }));

  if (qParam) {
    const q = qParam.toLowerCase();
    negociacoes = negociacoes.filter(
      (n) =>
        n.titulo.toLowerCase().includes(q) ||
        n.empresaNome.toLowerCase().includes(q),
    );
  }

  const temFiltroExtra = Boolean(
    filtrarVendedor || linhaParam || temperaturaParam || qParam,
  );

  const etapas: EtapaColuna[] = (etapasRaw ?? []).map((et) => {
    const cards = negociacoes.filter((n) => n.etapaId === et.id);
    if (temFiltroExtra) {
      return {
        id: et.id,
        nome: et.nome,
        ordem: et.ordem,
        qtd: cards.length,
        valor: cards.reduce((acc, c) => acc + c.valorEstimado, 0),
      };
    }
    const agg = aggByEtapa.get(et.id);
    return {
      id: et.id,
      nome: et.nome,
      ordem: et.ordem,
      qtd: agg?.qtd ?? 0,
      valor: agg?.valor ?? 0,
    };
  });

  const etapaNomeById = new Map(etapas.map((e) => [e.id, e.nome]));
  const linhas: LinhaLista[] = negociacoes.map((n) => ({
    ...n,
    etapaNome: etapaNomeById.get(n.etapaId) ?? "—",
  }));

  return (
    <Suspense fallback={null}>
      <FunilClient
        funis={funis}
        funilId={funilId}
        etapas={etapas}
        negociacoes={negociacoes}
        linhas={linhas}
        linhasOpcoes={(linhasRaw ?? []).map((l) => l.valor)}
        vendedores={vendedores ?? []}
        isDiretor={usuario.perfil === "diretor"}
        filtros={{
          vendedor: filtrarVendedor,
          linha: linhaParam ?? null,
          temperatura:
            temperaturaParam === "1" ||
            temperaturaParam === "2" ||
            temperaturaParam === "3"
              ? temperaturaParam
              : null,
          q: qParam,
          vista,
        }}
      />
    </Suspense>
  );
}
