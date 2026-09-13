"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { contatoSchema } from "@/lib/schemas/contato";
import { createClient } from "@/lib/supabase/server";

export type ContatoResumo = {
  id: string;
  empresa_id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  cargo: string | null;
  decisor: boolean;
};

export type ContatoActionResult =
  | { ok: true; contato: ContatoResumo }
  | { ok: false; error: string };

export async function listarContatosEmpresa(
  empresaId: string,
): Promise<{ ok: true; contatos: ContatoResumo[] } | { ok: false; error: string }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(empresaId);
  if (!idParsed.success) return { ok: false, error: "Empresa inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contatos")
    .select("id, empresa_id, nome, whatsapp, email, cargo, decisor")
    .eq("empresa_id", idParsed.data)
    .is("arquivado_em", null)
    .order("nome");

  if (error) return { ok: false, error: error.message };
  return { ok: true, contatos: data ?? [] };
}

export async function criarContato(
  input: z.input<typeof contatoSchema>,
): Promise<ContatoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = contatoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const whatsapp = parsed.data.whatsapp
    ? parsed.data.whatsapp.replace(/\D/g, "")
    : null;

  const { data, error } = await supabase
    .from("contatos")
    .insert({
      empresa_id: parsed.data.empresa_id,
      nome: parsed.data.nome,
      whatsapp,
      email: parsed.data.email,
      cargo: parsed.data.cargo,
      decisor: parsed.data.decisor ?? false,
    })
    .select("id, empresa_id, nome, whatsapp, email, cargo, decisor")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/empresas/${parsed.data.empresa_id}`);
  revalidatePath("/contatos");

  return { ok: true, contato: data };
}
