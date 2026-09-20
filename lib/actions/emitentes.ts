"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { ehDiretorDe } from "@/lib/auth/permissoes";
import { exigirDiretorDe, exigirDiretorEmAlguma } from "@/lib/auth/permissoes-server";
import type { Database } from "@/lib/database.types";
import { categoriaProdutoSchema, emitenteSchema } from "@/lib/schemas/emitente";
import { createClient } from "@/lib/supabase/server";

export type EmitenteRow = Database["public"]["Tables"]["emitentes"]["Row"];
export type CategoriaRow = Database["public"]["Tables"]["categorias_produto"]["Row"];

export type EmitenteActionResult =
  | { ok: true; id?: string; message?: string; path?: string | null }
  | { ok: false; error: string };

const MAX_LOGO = 2 * 1024 * 1024;
const MAX_CATALOGO = 10 * 1024 * 1024;

function revalidar() {
  revalidatePath("/", "layout");
}

function extensaoDe(nome: string, padrao: string): string {
  const ext = (nome.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext && ext.length <= 5 ? ext : padrao;
}

/** Path público (bucket `publico`) de um arquivo, ou null. */
export async function urlPublica(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  return supabase.storage.from("publico").getPublicUrl(path).data.publicUrl;
}

// ---------- Empresas vendedoras ----------

/** Empresas do usuário (todas as que participa), com flag de edição. */
export async function listarEmitentesConfig(): Promise<
  (EmitenteRow & { podeEditar: boolean; logoUrl: string | null })[]
> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ehDiretorEmAlguma) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("emitentes").select("*").order("ordem").order("nome");
  return (data ?? []).map((e) => ({
    ...e,
    podeEditar: ehDiretorDe(usuario, e.id),
    logoUrl: e.logo_path
      ? supabase.storage.from("publico").getPublicUrl(e.logo_path).data.publicUrl
      : null,
  }));
}

export async function salvarEmitente(
  id: string | null,
  input: z.input<typeof emitenteSchema>,
): Promise<EmitenteActionResult> {
  const parsed = emitenteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();

  if (id) {
    const diretor = await exigirDiretorDe(id);
    if (!diretor) return { ok: false, error: "Apenas o diretor desta empresa pode alterar." };
    const { error } = await supabase.from("emitentes").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidar();
    return { ok: true, id, message: "Empresa salva." };
  }

  const diretor = await exigirDiretorEmAlguma();
  if (!diretor) return { ok: false, error: "Apenas diretores podem criar empresas." };
  const { data, error } = await supabase
    .from("emitentes")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar." };
  revalidar();
  return { ok: true, id: data.id, message: "Empresa criada. Você é diretor dela." };
}

export async function uploadLogoEmitente(
  emitenteId: string,
  formData: FormData,
): Promise<EmitenteActionResult> {
  const diretor = await exigirDiretorDe(emitenteId);
  if (!diretor) return { ok: false, error: "Apenas o diretor desta empresa pode alterar." };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo de logo." };
  }
  if (file.size > MAX_LOGO) return { ok: false, error: "Logo deve ter no máximo 2 MB." };

  const path = `emitentes/${emitenteId}/logo-${Date.now()}.${extensaoDe(file.name, "png")}`;
  const supabase = await createClient();
  const { error: upErr } = await supabase.storage
    .from("publico")
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "image/png",
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { error } = await supabase.from("emitentes").update({ logo_path: path }).eq("id", emitenteId);
  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true, message: "Logo enviado.", path };
}

// ---------- Categorias de produto ----------

export async function listarCategorias(
  emitenteId: string | null,
): Promise<(CategoriaRow & { catalogoUrl: string | null })[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return [];
  const supabase = await createClient();
  let q = supabase.from("categorias_produto").select("*").order("ordem").order("nome");
  if (emitenteId) q = q.eq("emitente_id", emitenteId);
  const { data } = await q;
  return (data ?? []).map((c) => ({
    ...c,
    catalogoUrl:
      c.catalogo_url ??
      (c.catalogo_path
        ? supabase.storage.from("publico").getPublicUrl(c.catalogo_path).data.publicUrl
        : null),
  }));
}

export async function salvarCategoria(
  id: string | null,
  input: z.input<typeof categoriaProdutoSchema>,
): Promise<EmitenteActionResult> {
  const parsed = categoriaProdutoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const diretor = await exigirDiretorDe(parsed.data.emitente_id);
  if (!diretor) return { ok: false, error: "Apenas o diretor desta empresa pode alterar." };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase
      .from("categorias_produto")
      .update(parsed.data)
      .eq("id", id)
      .eq("emitente_id", parsed.data.emitente_id);
    if (error) return { ok: false, error: error.message };
    revalidar();
    return { ok: true, id };
  }
  const { data, error } = await supabase
    .from("categorias_produto")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar." };
  revalidar();
  return { ok: true, id: data.id };
}

async function uploadCatalogo(
  emitenteId: string,
  prefixo: "categoria" | "produto",
  formData: FormData,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const file = formData.get("catalogo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione o arquivo do catálogo." };
  }
  if (file.size > MAX_CATALOGO) return { ok: false, error: "Catálogo deve ter no máximo 10 MB." };
  const tipo = file.type || "application/pdf";
  if (!/^(application\/pdf|image\/)/.test(tipo)) {
    return { ok: false, error: "Envie um PDF ou imagem." };
  }
  const path = `emitentes/${emitenteId}/catalogos/${prefixo}-${crypto.randomUUID()}.${extensaoDe(file.name, "pdf")}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from("publico")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: tipo, upsert: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function uploadCatalogoCategoria(
  categoriaId: string,
  emitenteId: string,
  formData: FormData,
): Promise<EmitenteActionResult> {
  const diretor = await exigirDiretorDe(emitenteId);
  if (!diretor) return { ok: false, error: "Apenas o diretor desta empresa pode alterar." };
  const up = await uploadCatalogo(emitenteId, "categoria", formData);
  if (!up.ok) return up;
  const supabase = await createClient();
  const { error } = await supabase
    .from("categorias_produto")
    .update({ catalogo_path: up.path })
    .eq("id", categoriaId)
    .eq("emitente_id", emitenteId);
  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true, message: "Catálogo anexado.", path: up.path };
}

export async function uploadCatalogoProduto(
  produtoId: string,
  emitenteId: string,
  formData: FormData,
): Promise<EmitenteActionResult> {
  const diretor = await exigirDiretorDe(emitenteId);
  if (!diretor) return { ok: false, error: "Apenas o diretor desta empresa pode alterar." };
  const up = await uploadCatalogo(emitenteId, "produto", formData);
  if (!up.ok) return up;
  const supabase = await createClient();
  const { error } = await supabase
    .from("produtos")
    .update({ catalogo_path: up.path, atualizado_em: new Date().toISOString() })
    .eq("id", produtoId)
    .eq("emitente_id", emitenteId);
  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true, message: "Catálogo anexado.", path: up.path };
}

/** Remove o arquivo de catálogo anexado (mantém a URL externa, se houver). */
export async function removerCatalogo(
  alvo: "categoria" | "produto",
  id: string,
  emitenteId: string,
): Promise<EmitenteActionResult> {
  const diretor = await exigirDiretorDe(emitenteId);
  if (!diretor) return { ok: false, error: "Apenas o diretor desta empresa pode alterar." };
  const supabase = await createClient();
  const tabela = alvo === "categoria" ? "categorias_produto" : "produtos";
  const { data } = await supabase.from(tabela).select("catalogo_path").eq("id", id).maybeSingle();
  if (data?.catalogo_path) {
    await supabase.storage.from("publico").remove([data.catalogo_path]);
  }
  const { error } = await supabase
    .from(tabela)
    .update({ catalogo_path: null })
    .eq("id", id)
    .eq("emitente_id", emitenteId);
  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true };
}
