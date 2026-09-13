"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

export type NegociacaoActionResult =
  | {
      ok: true;
      precisaProximaAcao?: boolean;
      negociacaoId?: string;
    }
  | { ok: false; error: string };

const moverEtapaSchema = z.object({
  negociacaoId: z.uuid("Negociação inválida"),
  etapaId: z.uuid("Etapa inválida"),
});

/** Move a negociação para outra etapa (R3). O trigger grava interação `sistema`. */
export async function moverEtapa(
  negociacaoId: string,
  etapaId: string,
): Promise<NegociacaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = moverEtapaSchema.safeParse({ negociacaoId, etapaId });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();

  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, funil_id, etapa_id, status, arquivado_em")
    .eq("id", parsed.data.negociacaoId)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }
  if (negociacao.arquivado_em) {
    return { ok: false, error: "Negociação arquivada." };
  }
  if (negociacao.status !== "aberta") {
    return { ok: false, error: "Só é possível mover negociações abertas." };
  }

  if (negociacao.etapa_id === parsed.data.etapaId) {
    return { ok: true, negociacaoId: negociacao.id };
  }

  const { data: etapa, error: erroEtapa } = await supabase
    .from("etapas")
    .select("id, funil_id, ativo")
    .eq("id", parsed.data.etapaId)
    .maybeSingle();

  if (erroEtapa || !etapa || !etapa.ativo) {
    return { ok: false, error: "Etapa não encontrada." };
  }
  if (etapa.funil_id !== negociacao.funil_id) {
    return { ok: false, error: "Etapa não pertence ao funil da negociação." };
  }

  const { error: erroUpdate } = await supabase
    .from("negociacoes")
    .update({ etapa_id: parsed.data.etapaId })
    .eq("id", negociacao.id);

  if (erroUpdate) {
    return { ok: false, error: erroUpdate.message };
  }

  const { count, error: erroCount } = await supabase
    .from("acoes")
    .select("id", { count: "exact", head: true })
    .eq("negociacao_id", negociacao.id)
    .is("concluida_em", null);

  if (erroCount) {
    return { ok: false, error: erroCount.message };
  }

  const precisaProximaAcao = (count ?? 0) === 0;

  revalidatePath("/funil");
  revalidatePath("/hoje");
  revalidatePath(`/negociacoes/${negociacao.id}`);

  return {
    ok: true,
    precisaProximaAcao,
    negociacaoId: negociacao.id,
  };
}
