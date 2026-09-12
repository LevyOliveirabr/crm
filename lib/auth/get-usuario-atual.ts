import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type UsuarioAtual = Database["public"]["Tables"]["usuarios"]["Row"];

/** Retorna a linha de `usuarios` do usuário autenticado, com `perfil`. */
export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
