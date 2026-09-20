import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { adicionarDiasISO, hojeISO } from "@/lib/format";
import { normalizarItem, type ItemEntrada, type ProdutoBase } from "@/lib/orcamentos/itens";

type Client = SupabaseClient<Database>;

export type CabecalhoOrcamento = {
  titulo?: string | null;
  validade?: string | null;
  condicoes_pagamento?: string | null;
  prazo_entrega?: string | null;
  frete?: string | null;
  observacoes?: string | null;
  desconto_geral_pct?: number | null;
};

export type ResultadoGerado =
  | { ok: true; orcamentoId: string; numero: string; total: number; moveuEtapa: boolean; etapaNome: string | null }
  | { ok: false; error: string };

/**
 * Cria um orçamento `gerado` para a negociação (R6/R6a): número sequencial da
 * empresa vendedora, validade e condições padrão do emitente, itens opcionais
 * (produtos do catálogo da empresa ou itens livres). Aplica R6: anteriores
 * `enviado` → `substituido` e move a negociação para a primeira etapa
 * `conta_como_proposta`, se ainda estiver antes.
 *
 * Usado pela server action e pelo MCP (`montar_orcamento`). O `supabase`
 * recebido já carrega a RLS do usuário.
 */
export async function criarOrcamentoGerado(
  supabase: Client,
  input: {
    negociacaoId: string;
    itens?: ItemEntrada[];
    cabecalho?: CabecalhoOrcamento;
  },
): Promise<ResultadoGerado> {
  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, titulo, funil_id, etapa_id, status, arquivado_em, emitente_id")
    .eq("id", input.negociacaoId)
    .maybeSingle();
  if (erroNeg || !negociacao) return { ok: false, error: "Negociação não encontrada." };
  if (negociacao.arquivado_em) return { ok: false, error: "Negociação arquivada." };
  if (negociacao.status !== "aberta") return { ok: false, error: "Negociação fechada." };

  const { data: emitente } = await supabase
    .from("emitentes")
    .select("id, validade_padrao_dias, condicoes_pagamento_padrao, prazo_entrega_padrao")
    .eq("id", negociacao.emitente_id)
    .maybeSingle();
  if (!emitente) return { ok: false, error: "Empresa vendedora da negociação não encontrada." };

  // itens: resolve produtos (só do catálogo da empresa vendedora)
  const produtoIds = (input.itens ?? []).map((i) => i.produto_id).filter((v): v is string => Boolean(v));
  const produtos = new Map<string, ProdutoBase>();
  if (produtoIds.length > 0) {
    const { data } = await supabase
      .from("produtos")
      .select("id, nome, descricao, unidade, preco_base, emitente_id")
      .in("id", produtoIds)
      .eq("emitente_id", negociacao.emitente_id);
    for (const p of data ?? []) produtos.set(p.id, p);
  }
  const linhas = [];
  for (const [idx, entrada] of (input.itens ?? []).entries()) {
    if (entrada.produto_id && !produtos.has(entrada.produto_id)) {
      return { ok: false, error: `Item ${idx + 1}: produto não pertence à empresa vendedora da negociação.` };
    }
    const r = normalizarItem(entrada, entrada.produto_id ? (produtos.get(entrada.produto_id) ?? null) : null);
    if (!r.ok) return { ok: false, error: `Item ${idx + 1}: ${r.erro}` };
    linhas.push({ ...r.item, ordem: idx + 1 });
  }

  const { data: numero, error: erroNum } = await supabase.rpc("proximo_numero_orcamento", {
    p_emitente: emitente.id,
  });
  if (erroNum || !numero) return { ok: false, error: erroNum?.message ?? "Falha ao numerar o orçamento." };

  const hoje = hojeISO();
  const cab = input.cabecalho ?? {};
  const { data: orcamento, error: erroInsert } = await supabase
    .from("orcamentos")
    .insert({
      negociacao_id: negociacao.id,
      numero,
      valor: 0,
      subtotal: 0,
      enviado_em: hoje,
      validade: cab.validade ?? adicionarDiasISO(hoje, emitente.validade_padrao_dias ?? 15),
      situacao: "enviado",
      origem: "gerado",
      titulo: cab.titulo?.trim() || negociacao.titulo,
      condicoes_pagamento: cab.condicoes_pagamento ?? emitente.condicoes_pagamento_padrao,
      prazo_entrega: cab.prazo_entrega ?? emitente.prazo_entrega_padrao,
      frete: cab.frete ?? null,
      observacoes: cab.observacoes ?? null,
      desconto_geral_pct: cab.desconto_geral_pct ?? 0,
    })
    .select("id")
    .single();
  if (erroInsert || !orcamento) return { ok: false, error: erroInsert?.message ?? "Falha ao criar o orçamento." };

  if (linhas.length > 0) {
    const { error: erroItens } = await supabase
      .from("orcamento_itens")
      .insert(linhas.map((l) => ({ ...l, orcamento_id: orcamento.id })));
    if (erroItens) {
      await supabase.from("orcamentos").delete().eq("id", orcamento.id);
      return { ok: false, error: erroItens.message };
    }
  }

  // R6: anteriores enviados → substituído
  await supabase
    .from("orcamentos")
    .update({ situacao: "substituido" })
    .eq("negociacao_id", negociacao.id)
    .eq("situacao", "enviado")
    .neq("id", orcamento.id);

  // R6: mover para a primeira etapa "conta como proposta"
  let moveuEtapa = false;
  let etapaNome: string | null = null;
  const [{ data: etapaAtual }, { data: etapaProposta }] = await Promise.all([
    supabase.from("etapas").select("id, ordem").eq("id", negociacao.etapa_id).maybeSingle(),
    supabase
      .from("etapas")
      .select("id, nome, ordem")
      .eq("funil_id", negociacao.funil_id)
      .eq("conta_como_proposta", true)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (etapaAtual && etapaProposta && etapaAtual.ordem < etapaProposta.ordem) {
    const { error: erroMove } = await supabase
      .from("negociacoes")
      .update({ etapa_id: etapaProposta.id })
      .eq("id", negociacao.id);
    if (!erroMove) {
      moveuEtapa = true;
      etapaNome = etapaProposta.nome;
    }
  }

  const { data: atualizado } = await supabase
    .from("orcamentos")
    .select("valor")
    .eq("id", orcamento.id)
    .maybeSingle();

  return {
    ok: true,
    orcamentoId: orcamento.id,
    numero,
    total: Number(atualizado?.valor ?? 0),
    moveuEtapa,
    etapaNome,
  };
}
