"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type ConfigActionResult =
  | { ok: true; message?: string; id?: string; abertas?: number }
  | { ok: false; error: string; abertas?: number };

type TipoLista = Database["public"]["Enums"]["tipo_lista"];

async function exigirDiretor() {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.perfil !== "diretor" || !usuario.ativo) {
    return null;
  }
  return usuario;
}

function revalidateConfig() {
  revalidatePath("/configuracoes", "layout");
  revalidatePath("/funil");
  revalidatePath("/hoje");
}

// ---------- Funis ----------

export type FunilComEtapas = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  etapas: Database["public"]["Tables"]["etapas"]["Row"][];
};

export async function listarFunisComEtapas(): Promise<FunilComEtapas[]> {
  const diretor = await exigirDiretor();
  if (!diretor) return [];

  const supabase = await createClient();
  const { data: funis } = await supabase
    .from("funis")
    .select("*")
    .order("ordem");
  const { data: etapas } = await supabase
    .from("etapas")
    .select("*")
    .order("ordem");

  return (funis ?? []).map((f) => ({
    ...f,
    etapas: (etapas ?? []).filter((e) => e.funil_id === f.id),
  }));
}

export async function criarFunil(nome: string): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const n = nome.trim();
  if (!n) return { ok: false, error: "Informe o nome do funil." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("funis")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("funis")
    .insert({ nome: n, ordem: (max?.ordem ?? 0) + 1 })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, id: data.id };
}

export async function atualizarFunil(
  id: string,
  patch: { nome?: string; ativo?: boolean },
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const supabase = await createClient();
  const { error } = await supabase.from("funis").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true };
}

export async function criarEtapa(
  funilId: string,
  nome: string,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const n = nome.trim();
  if (!n) return { ok: false, error: "Informe o nome da etapa." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("etapas")
    .select("ordem")
    .eq("funil_id", funilId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("etapas")
    .insert({
      funil_id: funilId,
      nome: n,
      ordem: (max?.ordem ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, id: data.id };
}

export async function atualizarEtapa(
  id: string,
  patch: {
    nome?: string;
    dica?: string | null;
    conta_como_proposta?: boolean;
    ativo?: boolean;
  },
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const supabase = await createClient();

  if (patch.ativo === false) {
    const { count } = await supabase
      .from("negociacoes")
      .select("id", { count: "exact", head: true })
      .eq("etapa_id", id)
      .eq("status", "aberta")
      .is("arquivado_em", null);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Há ${count} negociação(ões) aberta(s) nesta etapa. Mova-as antes de desativar.`,
        abertas: count ?? 0,
      };
    }
  }

  const { error } = await supabase.from("etapas").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true };
}

export async function contarNegociacoesAbertasEtapa(
  etapaId: string,
): Promise<number> {
  const diretor = await exigirDiretor();
  if (!diretor) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("negociacoes")
    .select("id", { count: "exact", head: true })
    .eq("etapa_id", etapaId)
    .eq("status", "aberta")
    .is("arquivado_em", null);
  return count ?? 0;
}

export async function moverNegociacoesEtapa(
  deEtapaId: string,
  paraEtapaId: string,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  if (deEtapaId === paraEtapaId) {
    return { ok: false, error: "Escolha outra etapa de destino." };
  }

  const supabase = await createClient();
  const { data: destino, error: errDest } = await supabase
    .from("etapas")
    .select("id, funil_id")
    .eq("id", paraEtapaId)
    .single();
  if (errDest || !destino) {
    return { ok: false, error: errDest?.message ?? "Etapa destino inválida." };
  }

  const { error } = await supabase
    .from("negociacoes")
    .update({
      etapa_id: paraEtapaId,
      funil_id: destino.funil_id,
      etapa_desde: new Date().toISOString(),
    })
    .eq("etapa_id", deEtapaId)
    .eq("status", "aberta")
    .is("arquivado_em", null);

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, message: "Negociações movidas." };
}

/** Reordena etapas de um funil. `ordemIds` = ids na nova ordem (1..n). */
export async function reordenarEtapas(
  funilId: string,
  ordemIds: string[],
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  if (ordemIds.length === 0) return { ok: true };

  const supabase = await createClient();

  // Fase 1: evita conflito do unique (funil_id, ordem)
  for (let i = 0; i < ordemIds.length; i++) {
    const { error } = await supabase
      .from("etapas")
      .update({ ordem: -(i + 1) })
      .eq("id", ordemIds[i]!)
      .eq("funil_id", funilId);
    if (error) return { ok: false, error: error.message };
  }

  for (let i = 0; i < ordemIds.length; i++) {
    const { error } = await supabase
      .from("etapas")
      .update({ ordem: i + 1 })
      .eq("id", ordemIds[i]!)
      .eq("funil_id", funilId);
    if (error) return { ok: false, error: error.message };
  }

  revalidateConfig();
  return { ok: true };
}

// ---------- Listas ----------

export async function listarListasPorTipo(
  tipo: TipoLista,
): Promise<Database["public"]["Tables"]["listas"]["Row"][]> {
  const diretor = await exigirDiretor();
  if (!diretor) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listas")
    .select("*")
    .eq("tipo", tipo)
    .order("ordem");
  return data ?? [];
}

export async function criarListaItem(
  tipo: TipoLista,
  valor: string,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  const v = valor.trim();
  if (!v) return { ok: false, error: "Informe o valor." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("listas")
    .select("ordem")
    .eq("tipo", tipo)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("listas")
    .insert({ tipo, valor: v, ordem: (max?.ordem ?? 0) + 1 })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, id: data.id };
}

export async function atualizarListaItem(
  id: string,
  patch: { valor?: string; ativo?: boolean },
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  const supabase = await createClient();
  const { error } = await supabase.from("listas").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true };
}

export async function reordenarListas(
  tipo: TipoLista,
  ordemIds: string[],
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  const supabase = await createClient();

  for (let i = 0; i < ordemIds.length; i++) {
    const { error } = await supabase
      .from("listas")
      .update({ ordem: -(i + 1) })
      .eq("id", ordemIds[i]!)
      .eq("tipo", tipo);
    if (error) return { ok: false, error: error.message };
  }
  for (let i = 0; i < ordemIds.length; i++) {
    const { error } = await supabase
      .from("listas")
      .update({ ordem: i + 1 })
      .eq("id", ordemIds[i]!)
      .eq("tipo", tipo);
    if (error) return { ok: false, error: error.message };
  }
  revalidateConfig();
  return { ok: true };
}

// ---------- Parâmetros (config) ----------

export async function obterParametros(): Promise<Record<string, string>> {
  const diretor = await exigirDiretor();
  if (!diretor) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("config").select("chave, valor");
  const out: Record<string, string> = {};
  for (const row of data ?? []) out[row.chave] = row.valor;
  return out;
}

const parametrosSchema = z.object({
  dias_parada_negociacao: z.coerce.number().int().positive(),
  dias_parada_empresa: z.coerce.number().int().positive(),
  peso_fria: z.coerce.number().min(0).max(1),
  peso_morna: z.coerce.number().min(0).max(1),
  peso_quente: z.coerce.number().min(0).max(1),
  alerta_validade_orcamento_dias: z.coerce.number().int().nonnegative(),
  orcamento_prefixo: z.string().trim().min(1).max(20),
});

export async function salvarParametros(
  input: z.input<typeof parametrosSchema>,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const parsed = parametrosSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const rows = Object.entries(parsed.data).map(([chave, valor]) => ({
    chave,
    valor: String(valor),
  }));

  const { error } = await supabase.from("config").upsert(rows);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, message: "Parâmetros salvos." };
}

// ---------- Emitente ----------

export async function obterEmitente() {
  const diretor = await exigirDiretor();
  if (!diretor) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("emitente")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data;
}

const emitenteSchema = z.object({
  razao_social: z.string().trim().min(1, "Razão social é obrigatória"),
  cnpj: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  site: z.string().trim().optional().nullable(),
  validade_padrao_dias: z.coerce.number().int().positive().default(15),
  condicoes_pagamento_padrao: z.string().trim().optional().nullable(),
  prazo_entrega_padrao: z.string().trim().optional().nullable(),
  rodape: z.string().trim().optional().nullable(),
});

export async function salvarEmitente(
  input: z.input<typeof emitenteSchema>,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const parsed = emitenteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("emitente")
    .upsert({ id: 1, ...parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, message: "Emitente salvo." };
}

export async function uploadLogoEmitente(
  formData: FormData,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo de logo." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Logo deve ter no máximo 2 MB." };
  }

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `emitente/logo-${Date.now()}.${ext}`;
  const supabase = await createClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("publico")
    .upload(path, buffer, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (upErr) return { ok: false, error: upErr.message };

  const { error } = await supabase
    .from("emitente")
    .update({ logo_path: path })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, message: "Logo enviado." };
}

// ---------- Produtos ----------

export async function listarProdutos(busca?: string) {
  const diretor = await exigirDiretor();
  if (!diretor) return [];
  const supabase = await createClient();
  let q = supabase.from("produtos").select("*").order("nome");
  const termo = busca?.trim();
  if (termo) {
    q = q.or(
      `nome.ilike.%${termo}%,codigo.ilike.%${termo}%,descricao.ilike.%${termo}%`,
    );
  }
  const { data } = await q.limit(200);
  return data ?? [];
}

export async function salvarProduto(input: {
  id?: string;
  codigo?: string | null;
  nome: string;
  descricao?: string | null;
  linha?: string | null;
  unidade?: string;
  preco_base?: number;
  ativo?: boolean;
}): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const nome = input.nome.trim();
  if (!nome) return { ok: false, error: "Nome é obrigatório." };

  const row = {
    codigo: input.codigo?.trim() || null,
    nome,
    descricao: input.descricao?.trim() || null,
    linha: input.linha?.trim() || null,
    unidade: input.unidade?.trim() || "un",
    preco_base: Number(input.preco_base ?? 0),
    ativo: input.ativo ?? true,
    atualizado_em: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase
      .from("produtos")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidateConfig();
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("produtos")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, id: data.id };
}

export async function alternarProdutoAtivo(
  id: string,
  ativo: boolean,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("produtos")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true };
}

// ---------- Relatórios / Presidência ----------

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
  const diretor = await exigirDiretor();
  if (!diretor) {
    return { error: "Apenas o diretor pode salvar o comentário." };
  }

  const parsed = comentarioSchema.safeParse({ mes, texto });
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

  const chave = `comentario_${parsed.data.mes.slice(0, 7)}`;
  const supabase = await createClient();
  const { error } = await supabase.from("config").upsert({
    chave,
    valor: parsed.data.texto,
  });
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
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type ConfigActionResult =
  | { ok: true; message?: string; id?: string; abertas?: number }
  | { ok: false; error: string; abertas?: number };

type TipoLista = Database["public"]["Enums"]["tipo_lista"];

async function exigirDiretor() {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.perfil !== "diretor" || !usuario.ativo) {
    return null;
  }
  return usuario;
}

function revalidateConfig() {
  revalidatePath("/configuracoes", "layout");
  revalidatePath("/funil");
  revalidatePath("/hoje");
}

// ---------- Funis ----------

export type FunilComEtapas = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  etapas: Database["public"]["Tables"]["etapas"]["Row"][];
};

export async function listarFunisComEtapas(): Promise<FunilComEtapas[]> {
  const diretor = await exigirDiretor();
  if (!diretor) return [];

  const supabase = await createClient();
  const { data: funis } = await supabase
    .from("funis")
    .select("*")
    .order("ordem");
  const { data: etapas } = await supabase
    .from("etapas")
    .select("*")
    .order("ordem");

  return (funis ?? []).map((f) => ({
    ...f,
    etapas: (etapas ?? []).filter((e) => e.funil_id === f.id),
  }));
}

export async function criarFunil(nome: string): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const n = nome.trim();
  if (!n) return { ok: false, error: "Informe o nome do funil." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("funis")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("funis")
    .insert({ nome: n, ordem: (max?.ordem ?? 0) + 1 })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, id: data.id };
}

export async function atualizarFunil(
  id: string,
  patch: { nome?: string; ativo?: boolean },
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const supabase = await createClient();
  const { error } = await supabase.from("funis").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true };
}

export async function criarEtapa(
  funilId: string,
  nome: string,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const n = nome.trim();
  if (!n) return { ok: false, error: "Informe o nome da etapa." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("etapas")
    .select("ordem")
    .eq("funil_id", funilId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("etapas")
    .insert({
      funil_id: funilId,
      nome: n,
      ordem: (max?.ordem ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, id: data.id };
}

export async function atualizarEtapa(
  id: string,
  patch: {
    nome?: string;
    dica?: string | null;
    conta_como_proposta?: boolean;
    ativo?: boolean;
  },
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const supabase = await createClient();

  if (patch.ativo === false) {
    const { count } = await supabase
      .from("negociacoes")
      .select("id", { count: "exact", head: true })
      .eq("etapa_id", id)
      .eq("status", "aberta")
      .is("arquivado_em", null);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Há ${count} negociação(ões) aberta(s) nesta etapa. Mova-as antes de desativar.`,
        abertas: count ?? 0,
      };
    }
  }

  const { error } = await supabase.from("etapas").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true };
}

export async function contarNegociacoesAbertasEtapa(
  etapaId: string,
): Promise<number> {
  const diretor = await exigirDiretor();
  if (!diretor) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("negociacoes")
    .select("id", { count: "exact", head: true })
    .eq("etapa_id", etapaId)
    .eq("status", "aberta")
    .is("arquivado_em", null);
  return count ?? 0;
}

export async function moverNegociacoesEtapa(
  deEtapaId: string,
  paraEtapaId: string,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  if (deEtapaId === paraEtapaId) {
    return { ok: false, error: "Escolha outra etapa de destino." };
  }

  const supabase = await createClient();
  const { data: destino, error: errDest } = await supabase
    .from("etapas")
    .select("id, funil_id")
    .eq("id", paraEtapaId)
    .single();
  if (errDest || !destino) {
    return { ok: false, error: errDest?.message ?? "Etapa destino inválida." };
  }

  const { error } = await supabase
    .from("negociacoes")
    .update({
      etapa_id: paraEtapaId,
      funil_id: destino.funil_id,
      etapa_desde: new Date().toISOString(),
    })
    .eq("etapa_id", deEtapaId)
    .eq("status", "aberta")
    .is("arquivado_em", null);

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, message: "Negociações movidas." };
}

/** Reordena etapas de um funil. `ordemIds` = ids na nova ordem (1..n). */
export async function reordenarEtapas(
  funilId: string,
  ordemIds: string[],
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  if (ordemIds.length === 0) return { ok: true };

  const supabase = await createClient();

  // Fase 1: evita conflito do unique (funil_id, ordem)
  for (let i = 0; i < ordemIds.length; i++) {
    const { error } = await supabase
      .from("etapas")
      .update({ ordem: -(i + 1) })
      .eq("id", ordemIds[i]!)
      .eq("funil_id", funilId);
    if (error) return { ok: false, error: error.message };
  }

  for (let i = 0; i < ordemIds.length; i++) {
    const { error } = await supabase
      .from("etapas")
      .update({ ordem: i + 1 })
      .eq("id", ordemIds[i]!)
      .eq("funil_id", funilId);
    if (error) return { ok: false, error: error.message };
  }

  revalidateConfig();
  return { ok: true };
}

// ---------- Listas ----------

export async function listarListasPorTipo(
  tipo: TipoLista,
): Promise<Database["public"]["Tables"]["listas"]["Row"][]> {
  const diretor = await exigirDiretor();
  if (!diretor) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listas")
    .select("*")
    .eq("tipo", tipo)
    .order("ordem");
  return data ?? [];
}

export async function criarListaItem(
  tipo: TipoLista,
  valor: string,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  const v = valor.trim();
  if (!v) return { ok: false, error: "Informe o valor." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("listas")
    .select("ordem")
    .eq("tipo", tipo)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("listas")
    .insert({ tipo, valor: v, ordem: (max?.ordem ?? 0) + 1 })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, id: data.id };
}

export async function atualizarListaItem(
  id: string,
  patch: { valor?: string; ativo?: boolean },
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  const supabase = await createClient();
  const { error } = await supabase.from("listas").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true };
}

export async function reordenarListas(
  tipo: TipoLista,
  ordemIds: string[],
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  const supabase = await createClient();

  for (let i = 0; i < ordemIds.length; i++) {
    const { error } = await supabase
      .from("listas")
      .update({ ordem: -(i + 1) })
      .eq("id", ordemIds[i]!)
      .eq("tipo", tipo);
    if (error) return { ok: false, error: error.message };
  }
  for (let i = 0; i < ordemIds.length; i++) {
    const { error } = await supabase
      .from("listas")
      .update({ ordem: i + 1 })
      .eq("id", ordemIds[i]!)
      .eq("tipo", tipo);
    if (error) return { ok: false, error: error.message };
  }
  revalidateConfig();
  return { ok: true };
}

// ---------- Parâmetros (config) ----------

export async function obterParametros(): Promise<Record<string, string>> {
  const diretor = await exigirDiretor();
  if (!diretor) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("config").select("chave, valor");
  const out: Record<string, string> = {};
  for (const row of data ?? []) out[row.chave] = row.valor;
  return out;
}

const parametrosSchema = z.object({
  dias_parada_negociacao: z.coerce.number().int().positive(),
  dias_parada_empresa: z.coerce.number().int().positive(),
  peso_fria: z.coerce.number().min(0).max(1),
  peso_morna: z.coerce.number().min(0).max(1),
  peso_quente: z.coerce.number().min(0).max(1),
  alerta_validade_orcamento_dias: z.coerce.number().int().nonnegative(),
  orcamento_prefixo: z.string().trim().min(1).max(20),
});

export async function salvarParametros(
  input: z.input<typeof parametrosSchema>,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const parsed = parametrosSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const rows = Object.entries(parsed.data).map(([chave, valor]) => ({
    chave,
    valor: String(valor),
  }));

  const { error } = await supabase.from("config").upsert(rows);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, message: "Parâmetros salvos." };
}

// ---------- Emitente ----------

export async function obterEmitente() {
  const diretor = await exigirDiretor();
  if (!diretor) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("emitente")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data;
}

const emitenteSchema = z.object({
  razao_social: z.string().trim().min(1, "Razão social é obrigatória"),
  cnpj: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  site: z.string().trim().optional().nullable(),
  validade_padrao_dias: z.coerce.number().int().positive().default(15),
  condicoes_pagamento_padrao: z.string().trim().optional().nullable(),
  prazo_entrega_padrao: z.string().trim().optional().nullable(),
  rodape: z.string().trim().optional().nullable(),
});

export async function salvarEmitente(
  input: z.input<typeof emitenteSchema>,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const parsed = emitenteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("emitente")
    .upsert({ id: 1, ...parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, message: "Emitente salvo." };
}

export async function uploadLogoEmitente(
  formData: FormData,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo de logo." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Logo deve ter no máximo 2 MB." };
  }

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `emitente/logo-${Date.now()}.${ext}`;
  const supabase = await createClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("publico")
    .upload(path, buffer, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (upErr) return { ok: false, error: upErr.message };

  const { error } = await supabase
    .from("emitente")
    .update({ logo_path: path })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, message: "Logo enviado." };
}

// ---------- Produtos ----------

export async function listarProdutos(busca?: string) {
  const diretor = await exigirDiretor();
  if (!diretor) return [];
  const supabase = await createClient();
  let q = supabase.from("produtos").select("*").order("nome");
  const termo = busca?.trim();
  if (termo) {
    q = q.or(
      `nome.ilike.%${termo}%,codigo.ilike.%${termo}%,descricao.ilike.%${termo}%`,
    );
  }
  const { data } = await q.limit(200);
  return data ?? [];
}

export async function salvarProduto(input: {
  id?: string;
  codigo?: string | null;
  nome: string;
  descricao?: string | null;
  linha?: string | null;
  unidade?: string;
  preco_base?: number;
  ativo?: boolean;
}): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  const nome = input.nome.trim();
  if (!nome) return { ok: false, error: "Nome é obrigatório." };

  const row = {
    codigo: input.codigo?.trim() || null,
    nome,
    descricao: input.descricao?.trim() || null,
    linha: input.linha?.trim() || null,
    unidade: input.unidade?.trim() || "un",
    preco_base: Number(input.preco_base ?? 0),
    ativo: input.ativo ?? true,
    atualizado_em: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase
      .from("produtos")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidateConfig();
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("produtos")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true, id: data.id };
}

export async function alternarProdutoAtivo(
  id: string,
  ativo: boolean,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("produtos")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateConfig();
  return { ok: true };
}
