import { Suspense } from "react";

import { FunilClient } from "@/components/crm/funil-client";
import { BotaoFlutuanteNovaNegociacao } from "@/components/crm/botao-flutuante-nova-negociacao";
import { EstadoVazio, Pagina, PaginaCabecalho, Secao } from "@/components/crm/pagina";
import { carregarDadosFormNegociacao } from "@/lib/actions/form-negociacao";
import type { CartaoNegociacaoData } from "@/components/crm/cartao-negociacao";
import type { EtapaColuna } from "@/components/crm/funil-kanban";
import type { LinhaLista } from "@/components/crm/funil-lista";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  listarVendedoresVisiveis,
  podeVerEquipe,
  resolverFiltroVendedor,
} from "@/lib/auth/equipe";
import { aplicarEscopoEmitente, getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  emitente?: string | string[];
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

  const supabase = await createClient();
  const escopo = await getEscopoEmpresa(usuario, sp);
  const vendedores = await listarVendedoresVisiveis(supabase, usuario, escopo);
  const filtrarVendedor = resolverFiltroVendedor(usuario, vendedores, vendedorParam, escopo);

  const [{ data: funisRaw }, { data: linhasRaw }] =
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
    ]);

  const funis = funisRaw ?? [];
  if (funis.length === 0) {
    return (
      <Pagina>
        <PaginaCabecalho titulo="Funil" />
        <Secao>
          <EstadoVazio texto="Nenhum funil ativo cadastrado. Crie um em Configurações › Funis." />
        </Secao>
      </Pagina>
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
      aplicarEscopoEmitente(
        supabase
          .from("v_funil")
          .select("etapa_id, qtd, valor")
          .eq("funil_id", funilId),
        escopo,
      ),
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
            linha,
            emitente_nome
          `,
          )
          .eq("status", "aberta")
          .eq("funil_id", funilId)
          .order("atualizado_em", { ascending: false });

        query = aplicarEscopoEmitente(query, escopo);
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

  // v_funil tem uma linha por etapa × empresa vendedora: soma por etapa.
  const aggByEtapa = new Map<string, { qtd: number; valor: number }>();
  for (const r of funilAgg ?? []) {
    if (!r.etapa_id) continue;
    const cur = aggByEtapa.get(r.etapa_id) ?? { qtd: 0, valor: 0 };
    cur.qtd += Number(r.qtd ?? 0);
    cur.valor += Number(r.valor ?? 0);
    aggByEtapa.set(r.etapa_id, cur);
  }

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
      emitenteNome: escopo.emitenteId ? null : (n.emitente_nome ?? null),
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

  const dadosNova = await carregarDadosFormNegociacao();

  return (
    <Pagina className="pb-20">
      <Suspense fallback={null}>
        <FunilClient
        funis={funis}
        funilId={funilId}
        etapas={etapas}
        negociacoes={negociacoes}
        linhas={linhas}
        linhasOpcoes={(linhasRaw ?? []).map((l) => l.valor)}
        vendedores={vendedores}
        isDiretor={podeVerEquipe(usuario, escopo)}
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
          emitenteNome: escopo.emitente?.nome ?? null,
        }}
      />
      </Suspense>
      {dadosNova.ok ? <BotaoFlutuanteNovaNegociacao dados={dadosNova.dados} /> : null}
    </Pagina>
  );
}
