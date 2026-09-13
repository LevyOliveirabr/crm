"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { gerarApiKeyPlaintext, hashApiKey } from "@/lib/mcp-auth";
import { createClient } from "@/lib/supabase/server";

export type ApiKeyResumo = {
  id: string;
  nome: string;
  criado_em: string;
  revogado_em: string | null;
};

export type GerarApiKeyResult =
  | { ok: true; key: string; registro: ApiKeyResumo }
  | { ok: false; error: string };

export type ApiKeyActionResult =
  | { ok: true }
  | { ok: false; error: string };

const gerarSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(80),
});

export async function listarApiKeys(): Promise<ApiKeyResumo[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, nome, criado_em, revogado_em")
    .eq("usuario_id", usuario.id)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("[api_keys]", error.message);
    return [];
  }
  return data ?? [];
}

export async function gerarApiKey(
  nome: string,
): Promise<GerarApiKeyResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = gerarSchema.safeParse({ nome });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const plaintext = gerarApiKeyPlaintext();
  const keyHash = hashApiKey(plaintext);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      usuario_id: usuario.id,
      nome: parsed.data.nome,
      key_hash: keyHash,
    })
    .select("id, nome, criado_em, revogado_em")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Falha ao gerar key." };
  }

  revalidatePath("/configuracoes/api-keys");
  return { ok: true, key: plaintext, registro: data };
}

export async function revogarApiKey(id: string): Promise<ApiKeyActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Key inválida." };

  const supabase = await createClient();
  const { data: existente, error: erroBusca } = await supabase
    .from("api_keys")
    .select("id, revogado_em")
    .eq("id", idParsed.data)
    .eq("usuario_id", usuario.id)
    .maybeSingle();

  if (erroBusca || !existente) {
    return { ok: false, error: "API key não encontrada." };
  }
  if (existente.revogado_em) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("api_keys")
    .update({ revogado_em: new Date().toISOString() })
    .eq("id", existente.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes/api-keys");
  return { ok: true };
}
