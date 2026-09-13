"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { hojeISO } from "@/lib/format";
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

  return {
    ok: true,
    orcamentoId: orcamento.id,
    moveuEtapa,
    etapaNome,
    sugerirValor: atualizarValor ? null : valor,
  };
}
