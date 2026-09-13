"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

export type ConfigActionState = {
  error?: string;
  ok?: boolean;
};

const comentarioSchema = z.object({
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Mês inválido."),
  comentario: z.string().max(4000, "Comentário muito longo."),
});

/** Salva o comentário do diretor em `config` com chave `comentario_<aaaa-mm>`. */
export async function salvarComentarioDiretor(
  mes: string,
  comentario: string,
): Promise<ConfigActionState> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ativo) {
    return { error: "Não autenticado." };
  }
  if (usuario.perfil !== "diretor") {
    return { error: "Apenas o diretor pode salvar o comentário." };
  }

  const parsed = comentarioSchema.safeParse({ mes, comentario });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const chave = `comentario_${parsed.data.mes}`;
  const supabase = await createClient();
  const { error } = await supabase.from("config").upsert(
    { chave, valor: parsed.data.comentario },
    { onConflict: "chave" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/relatorios");
  return { ok: true };
}
