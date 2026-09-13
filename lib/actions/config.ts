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
  mes: z.string().regex(/^\d{4}-\d{2}/, "Mês inválido."),
  texto: z.string().max(4000),
});

export async function salvarComentarioPresidencia(
  mes: string,
  texto: string,
): Promise<ConfigActionState> {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.perfil !== "diretor" || !usuario.ativo) {
    return { error: "Apenas o diretor pode salvar o comentário." };
  }

  const parsed = comentarioSchema.safeParse({ mes, texto });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const chave = `comentario_${parsed.data.mes.slice(0, 7)}`;
  const supabase = await createClient();
  const { error } = await supabase.from("config").upsert({
    chave,
    valor: parsed.data.texto,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/relatorios");
  return { ok: true };
}
