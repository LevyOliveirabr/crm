"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { tipoInteracaoSchema } from "@/lib/schemas/interacao";
import { createClient } from "@/lib/supabase/server";

export type InteracaoActionResult =
  | { ok: true }
  | { ok: false; error: string };

const TIPOS_RAPIDOS = [
  "ligacao",
  "whatsapp",
  "visita",
  "reuniao",
  "anotacao",
] as const;

const registrarSchema = z.object({
  negociacaoId: z.uuid("Negociação inválida"),
  tipo: tipoInteracaoSchema.refine(
    (t) => (TIPOS_RAPIDOS as readonly string[]).includes(t),
    "Tipo de interação inválido para registro rápido.",
  ),
  texto: z.string().trim().optional().nullable(),
});

/** Registra interação rápida (R5 + Anotação na ficha). */
export async function registrarInteracao(
  negociacaoId: string,
  tipo: z.infer<typeof tipoInteracaoSchema>,
  texto?: string | null,
): Promise<InteracaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = registrarSchema.safeParse({ negociacaoId, tipo, texto });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();

  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, status, arquivado_em")
    .eq("id", parsed.data.negociacaoId)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }
  if (negociacao.arquivado_em) {
    return { ok: false, error: "Negociação arquivada." };
  }

  const { error: erroInsert } = await supabase.from("interacoes").insert({
    negociacao_id: parsed.data.negociacaoId,
    tipo: parsed.data.tipo,
    texto: parsed.data.texto ?? null,
    usuario_id: usuario.id,
  });

  if (erroInsert) {
    return { ok: false, error: erroInsert.message };
  }

  revalidatePath("/funil");
  revalidatePath("/hoje");
  revalidatePath(`/negociacoes/${parsed.data.negociacaoId}`);

  return { ok: true };
}
