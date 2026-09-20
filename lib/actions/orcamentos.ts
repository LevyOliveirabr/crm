"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { hojeISO } from "@/lib/format";
import { criarOrcamentoGerado as criarGeradoCore, type CabecalhoOrcamento } from "@/lib/orcamentos/gerado";
import { normalizarItem, type ItemEntrada } from "@/lib/orcamentos/itens";
import { createClient } from "@/lib/supabase/server";

export type OrcamentoActionResult =
  | {
      ok: true;
      orcamentoId?: string;
      moveuEtapa?: boolean;
      etapaNome?: string | null;
      sugerirValor?: number | null;
    }
  | { ok: false; error: string };

const uploadSchema = z.object({
  negociacaoId: z.uuid("Negociação inválida"),
  valor: z.coerce.number().nonnegative("Valor é obrigatório"),
  enviado_em: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  validade: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  atualizarValor: z.boolean().default(true),
});

/**
 * Cria orçamento por upload de PDF (R6).
 * Path no Storage: `<negociacao_id>/<uuid>.pdf`
 */
export async function criarOrcamentoUpload(
  formData: FormData,
): Promise<OrcamentoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: "PDF obrigatório." };
  }
  if (
    arquivo.type &&
    arquivo.type !== "application/pdf" &&
    !arquivo.name.toLowerCase().endsWith(".pdf")
  ) {
    return { ok: false, error: "Envie um arquivo PDF." };
  }

  const parsed = uploadSchema.safeParse({
    negociacaoId: formData.get("negociacaoId"),
    valor: formData.get("valor"),
    enviado_em: formData.get("enviado_em") || undefined,
    validade: formData.get("validade") || null,
    atualizarValor: formData.get("atualizarValor") !== "false",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const negociacaoId = parsed.data.negociacaoId;
  const valor = parsed.data.valor;
  const enviado_em = parsed.data.enviado_em ?? hojeISO();
  const validade = parsed.data.validade;
  const atualizarValor = parsed.data.atualizarValor;

  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select(
      "id, funil_id, etapa_id, status, arquivado_em, valor_estimado",
    )
    .eq("id", negociacaoId)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }
  if (negociacao.arquivado_em) {
    return { ok: false, error: "Negociação arquivada." };
  }
  if (negociacao.status !== "aberta") {
    return { ok: false, error: "Negociação fechada." };
  }

  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${negociacao.id}/${uuid}.pdf`;

  const bytes = await arquivo.arrayBuffer();
  const { error: erroUpload } = await supabase.storage
    .from("orcamentos")
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (erroUpload) {
    return { ok: false, error: erroUpload.message };
  }

  // Orçamentos anteriores enviados → substituido (R6)
  await supabase
    .from("orcamentos")
    .update({ situacao: "substituido" })
    .eq("negociacao_id", negociacao.id)
    .eq("situacao", "enviado");

  const { data: orcamento, error: erroInsert } = await supabase
    .from("orcamentos")
    .insert({
      negociacao_id: negociacao.id,
      valor,
      enviado_em,
      validade: validade || null,
      arquivo_path: path,
      situacao: "enviado",
      origem: "upload",
    })
    .select("id")
    .single();

  if (erroInsert || !orcamento) {
    return { ok: false, error: erroInsert?.message ?? "Falha ao salvar." };
  }

  // R6: mover para primeira etapa conta_como_proposta se ainda estiver antes
  let moveuEtapa = false;
  let etapaNome: string | null = null;

  const { data: etapaAtual } = await supabase
    .from("etapas")
    .select("id, ordem")
    .eq("id", negociacao.etapa_id)
    .maybeSingle();

  const { data: etapaProposta } = await supabase
    .from("etapas")
    .select("id, nome, ordem")
    .eq("funil_id", negociacao.funil_id)
    .eq("conta_como_proposta", true)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (
    etapaAtual &&
    etapaProposta &&
    etapaAtual.ordem < etapaProposta.ordem
  ) {
    const { error: erroMove } = await supabase
      .from("negociacoes")
      .update({ etapa_id: etapaProposta.id })
      .eq("id", negociacao.id);
    if (!erroMove) {
      moveuEtapa = true;
      etapaNome = etapaProposta.nome;
    }
  }

  if (atualizarValor) {
    await supabase
      .from("negociacoes")
      .update({ valor_estimado: valor })
      .eq("id", negociacao.id);
  }

  revalidatePath(`/negociacoes/${negociacao.id}`);
  revalidatePath("/funil");
  revalidatePath("/hoje");
  revalidatePath("/dashboard");

  return {
    ok: true,
    orcamentoId: orcamento.id,
    moveuEtapa,
    etapaNome,
    sugerirValor: atualizarValor ? null : valor,
  };
}

// =========================================================
// Orçamento montado por itens (origem = 'gerado')
// =========================================================

function revalidarOrcamento(orcamentoId: string, negociacaoId?: string) {
  revalidatePath(`/orcamentos/${orcamentoId}`);
  if (negociacaoId) revalidatePath(`/negociacoes/${negociacaoId}`);
  revalidatePath("/funil");
  revalidatePath("/hoje");
  revalidatePath("/dashboard");
}

/** "Montar orçamento" na ficha: cria o orçamento gerado vazio e abre o editor. */
export async function criarOrcamentoGerado(
  negociacaoId: string,
): Promise<OrcamentoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };
  if (!z.uuid().safeParse(negociacaoId).success) return { ok: false, error: "Negociação inválida." };

  const supabase = await createClient();
  const res = await criarGeradoCore(supabase, { negociacaoId });
  if (!res.ok) return res;

  revalidarOrcamento(res.orcamentoId, negociacaoId);
  return { ok: true, orcamentoId: res.orcamentoId, moveuEtapa: res.moveuEtapa, etapaNome: res.etapaNome };
}

/** Orçamento gerado, aberto e da negociação aberta (senão erro). */
async function orcamentoEditavel(orcamentoId: string) {
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orcamentos")
    .select("id, origem, situacao, negociacao_id, negociacoes!inner ( status, arquivado_em, emitente_id )")
    .eq("id", orcamentoId)
    .maybeSingle();
  type NegJoin = { status: string; arquivado_em: string | null; emitente_id: string };
  const negRaw = o?.negociacoes as unknown as NegJoin | NegJoin[] | null;
  const neg = Array.isArray(negRaw) ? negRaw[0] : negRaw;
  if (!o || !neg) return { ok: false as const, error: "Orçamento não encontrado." };
  if (o.origem !== "gerado") return { ok: false as const, error: "Só orçamentos montados no sistema têm itens editáveis." };
  if (o.situacao !== "enviado") return { ok: false as const, error: "Orçamento já aprovado, recusado ou substituído." };
  if (neg.status !== "aberta" || neg.arquivado_em) return { ok: false as const, error: "Negociação fechada." };
  return { ok: true as const, supabase, orcamento: o, emitenteId: neg.emitente_id, negociacaoId: o.negociacao_id };
}

/** Produtos ativos do catálogo da empresa vendedora do orçamento. */
export async function buscarProdutosParaOrcamento(
  orcamentoId: string,
  texto: string,
): Promise<{ id: string; codigo: string | null; nome: string; unidade: string; preco_base: number; categoria: string | null }[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !z.uuid().safeParse(orcamentoId).success) return [];
  const ctx = await orcamentoEditavel(orcamentoId);
  if (!ctx.ok) return [];
  const q = texto.trim().replace(/[%_,]/g, "");
  let query = ctx.supabase
    .from("produtos")
    .select("id, codigo, nome, unidade, preco_base, categorias_produto ( nome )")
    .eq("emitente_id", ctx.emitenteId)
    .eq("ativo", true)
    .order("nome")
    .limit(12);
  if (q) query = query.or(`nome.ilike.%${q}%,codigo.ilike.%${q}%`);
  const { data } = await query;
  type Row = { id: string; codigo: string | null; nome: string; unidade: string; preco_base: number; categorias_produto: { nome: string } | { nome: string }[] | null };
  return ((data ?? []) as unknown as Row[]).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    unidade: p.unidade,
    preco_base: Number(p.preco_base),
    categoria: (Array.isArray(p.categorias_produto) ? p.categorias_produto[0]?.nome : p.categorias_produto?.nome) ?? null,
  }));
}

export async function adicionarItemOrcamento(
  orcamentoId: string,
  entrada: ItemEntrada,
): Promise<OrcamentoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };
  if (!z.uuid().safeParse(orcamentoId).success) return { ok: false, error: "Orçamento inválido." };
  const ctx = await orcamentoEditavel(orcamentoId);
  if (!ctx.ok) return ctx;

  let produto = null;
  if (entrada.produto_id) {
    const { data } = await ctx.supabase
      .from("produtos")
      .select("id, nome, descricao, unidade, preco_base, emitente_id")
      .eq("id", entrada.produto_id)
      .eq("emitente_id", ctx.emitenteId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Produto não pertence à empresa vendedora desta negociação." };
    produto = data;
  }
  const r = normalizarItem(entrada, produto);
  if (!r.ok) return { ok: false, error: r.erro };

  const { data: max } = await ctx.supabase
    .from("orcamento_itens")
    .select("ordem")
    .eq("orcamento_id", orcamentoId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await ctx.supabase
    .from("orcamento_itens")
    .insert({ ...r.item, orcamento_id: orcamentoId, ordem: (max?.ordem ?? 0) + 1 });
  if (error) return { ok: false, error: error.message };
  revalidarOrcamento(orcamentoId, ctx.negociacaoId);
  return { ok: true, orcamentoId };
}

export async function atualizarItemOrcamento(
  orcamentoId: string,
  itemId: string,
  entrada: ItemEntrada,
): Promise<OrcamentoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };
  if (!z.uuid().safeParse(orcamentoId).success || !z.uuid().safeParse(itemId).success) {
    return { ok: false, error: "Item inválido." };
  }
  const ctx = await orcamentoEditavel(orcamentoId);
  if (!ctx.ok) return ctx;
  const r = normalizarItem({ ...entrada, produto_id: null }, null);
  if (!r.ok) return { ok: false, error: r.erro };
  const { produto_id: _p, ...campos } = r.item;
  void _p;
  const { error } = await ctx.supabase
    .from("orcamento_itens")
    .update(campos)
    .eq("id", itemId)
    .eq("orcamento_id", orcamentoId);
  if (error) return { ok: false, error: error.message };
  revalidarOrcamento(orcamentoId, ctx.negociacaoId);
  return { ok: true, orcamentoId };
}

export async function removerItemOrcamento(
  orcamentoId: string,
  itemId: string,
): Promise<OrcamentoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };
  if (!z.uuid().safeParse(orcamentoId).success || !z.uuid().safeParse(itemId).success) {
    return { ok: false, error: "Item inválido." };
  }
  const ctx = await orcamentoEditavel(orcamentoId);
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("orcamento_itens")
    .delete()
    .eq("id", itemId)
    .eq("orcamento_id", orcamentoId);
  if (error) return { ok: false, error: error.message };
  revalidarOrcamento(orcamentoId, ctx.negociacaoId);
  return { ok: true, orcamentoId };
}

const cabecalhoSchema = z.object({
  titulo: z.string().trim().max(200).optional().nullable(),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  condicoes_pagamento: z.string().trim().max(2000).optional().nullable(),
  prazo_entrega: z.string().trim().max(500).optional().nullable(),
  frete: z.string().trim().max(200).optional().nullable(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  desconto_geral_pct: z.coerce.number().min(0).max(100).optional().nullable(),
});

export async function salvarCabecalhoOrcamento(
  orcamentoId: string,
  input: CabecalhoOrcamento,
): Promise<OrcamentoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };
  if (!z.uuid().safeParse(orcamentoId).success) return { ok: false, error: "Orçamento inválido." };
  const parsed = cabecalhoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await orcamentoEditavel(orcamentoId);
  if (!ctx.ok) return ctx;

  const { error } = await ctx.supabase
    .from("orcamentos")
    .update({
      titulo: parsed.data.titulo || null,
      validade: parsed.data.validade || null,
      condicoes_pagamento: parsed.data.condicoes_pagamento || null,
      prazo_entrega: parsed.data.prazo_entrega || null,
      frete: parsed.data.frete || null,
      observacoes: parsed.data.observacoes || null,
      desconto_geral_pct: parsed.data.desconto_geral_pct ?? 0,
    })
    .eq("id", orcamentoId);
  if (error) return { ok: false, error: error.message };

  // o trigger de itens recalcula só em insert/update/delete de item: força o recálculo do desconto geral
  const { data: itens } = await ctx.supabase
    .from("orcamento_itens")
    .select("total")
    .eq("orcamento_id", orcamentoId);
  const subtotal = (itens ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0);
  const total = Math.round(subtotal * (1 - (parsed.data.desconto_geral_pct ?? 0) / 100) * 100) / 100;
  await ctx.supabase
    .from("orcamentos")
    .update({ subtotal: Math.round(subtotal * 100) / 100, valor: total })
    .eq("id", orcamentoId);

  revalidarOrcamento(orcamentoId, ctx.negociacaoId);
  return { ok: true, orcamentoId };
}

/** Copia o total do orçamento para o valor estimado da negociação. */
export async function usarTotalComoValorNegociacao(
  orcamentoId: string,
): Promise<OrcamentoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };
  if (!z.uuid().safeParse(orcamentoId).success) return { ok: false, error: "Orçamento inválido." };
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orcamentos")
    .select("valor, negociacao_id")
    .eq("id", orcamentoId)
    .maybeSingle();
  if (!o) return { ok: false, error: "Orçamento não encontrado." };
  const { error } = await supabase
    .from("negociacoes")
    .update({ valor_estimado: Number(o.valor ?? 0) })
    .eq("id", o.negociacao_id);
  if (error) return { ok: false, error: error.message };
  revalidarOrcamento(orcamentoId, o.negociacao_id);
  return { ok: true, orcamentoId, sugerirValor: Number(o.valor ?? 0) };
}
