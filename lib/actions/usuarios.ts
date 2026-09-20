"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAppUrl } from "@/lib/app-url";
import { exigirDiretorEmAlguma } from "@/lib/auth/permissoes-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type UsuarioActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
};

const convidarSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z.email("Informe um e-mail válido."),
  perfil: z.enum(["diretor", "gerente", "vendedor"]),
});


export async function convidarUsuarioAction(
  _prev: UsuarioActionState,
  formData: FormData,
): Promise<UsuarioActionState> {
  const diretor = await exigirDiretorEmAlguma();
  if (!diretor) {
    return { error: "Apenas o diretor pode convidar usuários." };
  }

  const parsed = convidarSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    perfil: formData.get("perfil"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const appUrl = getAppUrl();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      nome: parsed.data.nome,
      perfil: parsed.data.perfil,
    },
    redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent("/auth/definir-senha")}`,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/configuracoes/usuarios");
  return { ok: true, message: `Convite enviado para ${parsed.data.email}.` };
}

export async function alternarUsuarioAtivoAction(
  id: string,
  ativo: boolean,
): Promise<UsuarioActionState> {
  const diretor = await exigirDiretorEmAlguma();
  if (!diretor) {
    return { error: "Apenas o diretor pode alterar usuários." };
  }

  if (diretor.id === id && !ativo) {
    return { error: "Você não pode desativar a si mesmo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ ativo })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/configuracoes/usuarios");
  return { ok: true };
}

/** Define (ou remove) o gerente de um vendedor. */
export async function definirGerenteAction(
  usuarioId: string,
  gerenteId: string | null,
): Promise<UsuarioActionState> {
  const diretor = await exigirDiretorEmAlguma();
  if (!diretor) return { error: "Apenas o diretor pode alterar usuários." };
  if (!z.uuid().safeParse(usuarioId).success) return { error: "Usuário inválido." };
  if (gerenteId != null && !z.uuid().safeParse(gerenteId).success) {
    return { error: "Gerente inválido." };
  }
  if (gerenteId === usuarioId) return { error: "Um usuário não pode ser gerente de si mesmo." };

  const supabase = await createClient();
  if (gerenteId) {
    const { data: g } = await supabase
      .from("usuarios")
      .select("id, perfil, ativo")
      .eq("id", gerenteId)
      .maybeSingle();
    if (!g || !g.ativo || g.perfil !== "gerente") {
      return { error: "Escolha um usuário ativo com perfil gerente." };
    }
  }
  const { error } = await supabase
    .from("usuarios")
    .update({ gerente_id: gerenteId })
    .eq("id", usuarioId);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes/usuarios");
  return { ok: true };
}

export type UsuarioLista = Database["public"]["Tables"]["usuarios"]["Row"];

export async function listarUsuarios(): Promise<UsuarioLista[]> {
  const diretor = await exigirDiretorEmAlguma();
  if (!diretor) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("nome");

  if (error || !data) return [];
  return data;
}
