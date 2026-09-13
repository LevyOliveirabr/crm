import { notFound } from "next/navigation";

import {
  EmpresaFicha,
  type ContatoEmpresaItem,
  type NegociacaoEmpresaItem,
  type TimelineEmpresaItem,
} from "@/components/crm/empresa-ficha";
import { carregarDadosFormNegociacao } from "@/lib/actions/form-negociacao";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;

export default async function EmpresaDetalhePage({
  params,
}: {
  params: Params;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: viewRow },
    { data: empresaRow },
    dadosNovaRes,
    { data: vendedores },
    { data: listas },
  ] = await Promise.all([
    supabase.from("v_empresas").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("empresas")
      .select(
        "id, nome, cidade, uf, segmento, cnpj, responsavel_id, observacoes, arquivado_em, usuarios:responsavel_id(nome)",
      )
      .eq("id", id)
      .maybeSingle(),
    carregarDadosFormNegociacao(),
    supabase
      .from("usuarios")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("listas")
      .select("valor")
      .eq("tipo", "segmento")
      .eq("ativo", true)
      .order("ordem"),
  ]);

  const base = viewRow ?? empresaRow;
  if (!base || ("arquivado_em" in base && base.arquivado_em)) {
    notFound();
  }

  const responsavelNome =
    viewRow?.responsavel_nome ??
    (empresaRow?.usuarios as { nome: string } | null)?.nome ??
    null;

  const empresa = {
    id: (viewRow?.id ?? empresaRow!.id) as string,
    nome: (viewRow?.nome ?? empresaRow!.nome) as string,
    cidade: (viewRow?.cidade ?? empresaRow!.cidade) as string | null,
    uf: (viewRow?.uf ?? empresaRow!.uf) as string | null,
    segmento: (viewRow?.segmento ?? empresaRow!.segmento) as string | null,
    cnpj: (viewRow?.cnpj ?? empresaRow!.cnpj) as string | null,
    responsavelId: (viewRow?.responsavel_id ??
      empresaRow!.responsavel_id) as string | null,
    responsavelNome,
    observacoes: (viewRow?.observacoes ??
      empresaRow!.observacoes) as string | null,
    aberto: Number(viewRow?.aberto ?? 0),
    vendido: Number(viewRow?.vendido ?? 0),
    perdido: Number(viewRow?.perdido ?? 0),
    qtdNegociacoes: Number(viewRow?.qtd_negociacoes ?? 0),
    ticketMedio:
      viewRow?.ticket_medio != null ? Number(viewRow.ticket_medio) : null,
    cicloMedioDias:
      viewRow?.ciclo_medio_dias != null
        ? Number(viewRow.ciclo_medio_dias)
        : null,
    ultimoContato: (viewRow?.ultimo_contato as string | null) ?? null,
  };

  const podeEditar =
    usuario.perfil === "diretor" ||
    empresa.responsavelId == null ||
    empresa.responsavelId === usuario.id;

  const [{ data: negociacoesRaw }, { data: contatosRaw }] = await Promise.all([
    supabase
      .from("v_negociacoes")
      .select(
        "id, titulo, status, valor_estimado, valor_final, etapa_nome, responsavel_nome",
      )
      .eq("empresa_id", id)
      .order("status"),
    supabase
      .from("contatos")
      .select("id, nome, whatsapp, email, cargo, decisor")
      .eq("empresa_id", id)
      .is("arquivado_em", null)
      .order("nome"),
  ]);

  const negociacoes: NegociacaoEmpresaItem[] = (negociacoesRaw ?? []).map(
    (n) => ({
      id: n.id!,
      titulo: n.titulo ?? "",
      status: (n.status ?? "aberta") as NegociacaoEmpresaItem["status"],
      valorEstimado: Number(n.valor_estimado ?? 0),
      valorFinal: n.valor_final != null ? Number(n.valor_final) : null,
      etapaNome: n.etapa_nome,
      responsavelNome: n.responsavel_nome,
    }),
  );

  const contatos: ContatoEmpresaItem[] = (contatosRaw ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    whatsapp: c.whatsapp,
    email: c.email,
    cargo: c.cargo,
    decisor: c.decisor,
  }));

  // Timeline consolidada: interações + ações concluídas + orçamentos
  const negIds = negociacoes.map((n) => n.id);
  const tituloPorNeg = new Map(negociacoes.map((n) => [n.id, n.titulo]));

  let timeline: TimelineEmpresaItem[] = [];
  if (negIds.length > 0) {
    const [{ data: interacoes }, { data: acoes }, { data: orcamentos }] =
      await Promise.all([
        supabase
          .from("interacoes")
          .select("id, negociacao_id, tipo, texto, criado_em")
          .in("negociacao_id", negIds)
          .order("criado_em", { ascending: false }),
        supabase
          .from("acoes")
          .select("id, negociacao_id, descricao, data, concluida_em, criado_em")
          .in("negociacao_id", negIds)
          .not("concluida_em", "is", null)
          .order("concluida_em", { ascending: false }),
        supabase
          .from("orcamentos")
          .select("id, negociacao_id, valor, numero, situacao, criado_em")
          .in("negociacao_id", negIds)
          .order("criado_em", { ascending: false }),
      ]);

    const items: TimelineEmpresaItem[] = [];
    for (const i of interacoes ?? []) {
      items.push({
        kind: "interacao",
        id: i.id,
        em: i.criado_em,
        tipo: i.tipo,
        texto: i.texto,
        negociacaoId: i.negociacao_id,
        negociacaoTitulo: tituloPorNeg.get(i.negociacao_id) ?? "Negociação",
      });
    }
    for (const a of acoes ?? []) {
      items.push({
        kind: "acao",
        id: a.id,
        em: a.concluida_em ?? a.criado_em,
        descricao: a.descricao,
        data: a.data,
        negociacaoId: a.negociacao_id,
        negociacaoTitulo: tituloPorNeg.get(a.negociacao_id) ?? "Negociação",
      });
    }
    for (const o of orcamentos ?? []) {
      items.push({
        kind: "orcamento",
        id: o.id,
        em: o.criado_em,
        valor: Number(o.valor ?? 0),
        numero: o.numero,
        situacao: o.situacao,
        negociacaoId: o.negociacao_id,
        negociacaoTitulo: tituloPorNeg.get(o.negociacao_id) ?? "Negociação",
      });
    }
    items.sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : 0));
    timeline = items;
  }

  const dadosNova =
    dadosNovaRes.ok
      ? dadosNovaRes.dados
      : { funis: [], linhas: [], origens: [], segmentos: [] };

  return (
    <div className="p-4 lg:p-6">
      <EmpresaFicha
        empresa={empresa}
        negociacoes={negociacoes}
        contatos={contatos}
        timeline={timeline}
        segmentos={(listas ?? []).map((l) => l.valor)}
        vendedores={vendedores ?? []}
        podeEditar={podeEditar}
        dadosNova={dadosNova}
      />
    </div>
  );
}
