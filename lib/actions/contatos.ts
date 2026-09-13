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

export type ContatoListaItem = ContatoResumo & {
  empresaNome: string;
};

export type ContatoActionResult =
  | { ok: true; contato: ContatoResumo }
  | { ok: false; error: string };

async function podeEditarContatoEmpresa(
  empresaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const supabase = await createClient();
  const { data: empresa, error } = await supabase
    .from("empresas")
    .select("id, responsavel_id, arquivado_em")
    .eq("id", empresaId)
    .maybeSingle();

  if (error || !empresa || empresa.arquivado_em) {
    return { ok: false, error: "Empresa não encontrada." };
  }

  const pode =
    usuario.perfil === "diretor" ||
    empresa.responsavel_id == null ||
    empresa.responsavel_id === usuario.id;

  if (!pode) {
    return { ok: false, error: "Sem permissão para editar contatos desta empresa." };
  }

  return { ok: true };
}

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

  const perm = await podeEditarContatoEmpresa(parsed.data.empresa_id);
  if (!perm.ok) return perm;

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

export async function atualizarContato(
  contatoId: string,
  input: z.input<typeof contatoSchema>,
): Promise<ContatoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(contatoId);
  if (!idParsed.success) return { ok: false, error: "Contato inválido." };

  const parsed = contatoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const { data: atual, error: erroAtual } = await supabase
    .from("contatos")
    .select("id, empresa_id, arquivado_em")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (erroAtual || !atual || atual.arquivado_em) {
    return { ok: false, error: "Contato não encontrado." };
  }

  const perm = await podeEditarContatoEmpresa(atual.empresa_id);
  if (!perm.ok) return perm;

  // Troca de empresa: precisa poder editar a destino também
  if (parsed.data.empresa_id !== atual.empresa_id) {
    const permDestino = await podeEditarContatoEmpresa(parsed.data.empresa_id);
    if (!permDestino.ok) return permDestino;
  }

  const whatsapp = parsed.data.whatsapp
    ? parsed.data.whatsapp.replace(/\D/g, "")
    : null;

  const { data, error } = await supabase
    .from("contatos")
    .update({
      empresa_id: parsed.data.empresa_id,
      nome: parsed.data.nome,
      whatsapp,
      email: parsed.data.email,
      cargo: parsed.data.cargo,
      decisor: parsed.data.decisor ?? false,
    })
    .eq("id", atual.id)
    .select("id, empresa_id, nome, whatsapp, email, cargo, decisor")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return { ok: false, error: "Sem permissão para editar este contato." };
  }

  revalidatePath(`/empresas/${atual.empresa_id}`);
  revalidatePath(`/empresas/${parsed.data.empresa_id}`);
  revalidatePath("/contatos");

  return { ok: true, contato: data };
}

/** Arquivar contato (R14). */
export async function arquivarContato(
  contatoId: string,
): Promise<{ ok: true; contatoId: string } | { ok: false; error: string }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(contatoId);
  if (!idParsed.success) return { ok: false, error: "Contato inválido." };

  const supabase = await createClient();
  const { data: contato, error } = await supabase
    .from("contatos")
    .select("id, empresa_id, arquivado_em")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (error || !contato) {
    return { ok: false, error: "Contato não encontrado." };
  }
  if (contato.arquivado_em) {
    return { ok: true, contatoId: contato.id };
  }

  const perm = await podeEditarContatoEmpresa(contato.empresa_id);
  if (!perm.ok) return perm;

  const { error: erroUpdate } = await supabase
    .from("contatos")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", contato.id);

  if (erroUpdate) return { ok: false, error: erroUpdate.message };

  revalidatePath(`/empresas/${contato.empresa_id}`);
  revalidatePath("/contatos");

  return { ok: true, contatoId: contato.id };
}
