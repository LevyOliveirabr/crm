"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { ehDiretorDe } from "@/lib/auth/permissoes";
import { exigirDiretorDe, exigirDiretorEmAlguma } from "@/lib/auth/permissoes-server";
import { chaveComentarioPresidencia } from "@/lib/relatorios/dados";
import { produtoSchema } from "@/lib/schemas/produto";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type ConfigActionResult =
  | { ok: true; message?: string; id?: string; abertas?: number }
  | { ok: false; error: string; abertas?: number };

type TipoLista = Database["public"]["Enums"]["tipo_lista"];


function revalidateConfig() {
  revalidatePath("/configuracoes", "layout");
  revalidatePath("/funil");
  revalidatePath("/hoje");
  revalidatePath("/dashboard");
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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
    /** 0 a 100, ou null para usar só a temperatura na previsão. */
    probabilidade?: number | null;
  },
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretorEmAlguma();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode alterar." };

  if (patch.probabilidade != null) {
    const p = Math.round(Number(patch.probabilidade));
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      return { ok: false, error: "Probabilidade deve ser entre 0 e 100." };
    }
    patch.probabilidade = p;
  }

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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
  const diretor = await exigirDiretorEmAlguma();
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
});

export async function salvarParametros(
  input: z.input<typeof parametrosSchema>,
): Promise<ConfigActionResult> {
  const diretor = await exigirDiretorEmAlguma();
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

// ---------- Produtos ----------

export type ProdutoLista = Database["public"]["Tables"]["produtos"]["Row"] & {
  emitente_nome: string;
  categoria_nome: string | null;
  catalogo_url_final: string | null;
  podeEditar: boolean;
};

/** Produtos das empresas do usuário (ou só da empresa informada). */
export async function listarProdutos(
  busca?: string,
  emitenteId?: string | null,
): Promise<ProdutoLista[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ehDiretorEmAlguma) return [];
  const supabase = await createClient();
  let q = supabase
    .from("produtos")
    .select("*, emitentes ( nome ), categorias_produto ( nome )")
    .order("nome");
  if (emitenteId) q = q.eq("emitente_id", emitenteId);
  const termo = busca?.trim();
  if (termo) {
    q = q.or(
      `nome.ilike.%${termo}%,codigo.ilike.%${termo}%,descricao.ilike.%${termo}%`,
    );
  }
  const { data } = await q.limit(300);
  type Join = Database["public"]["Tables"]["produtos"]["Row"] & {
    emitentes: { nome: string } | { nome: string }[] | null;
    categorias_produto: { nome: string } | { nome: string }[] | null;
  };
  const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  return ((data ?? []) as unknown as Join[]).map((p) => {
    const { emitentes, categorias_produto, ...row } = p;
    return {
      ...row,
      emitente_nome: um(emitentes)?.nome ?? "—",
      categoria_nome: um(categorias_produto)?.nome ?? null,
      catalogo_url_final:
        row.catalogo_url ??
        (row.catalogo_path
          ? supabase.storage.from("publico").getPublicUrl(row.catalogo_path).data.publicUrl
          : null),
      podeEditar: ehDiretorDe(usuario, row.emitente_id),
    };
  });
}

export async function salvarProduto(
  input: { id?: string } & z.input<typeof produtoSchema>,
): Promise<ConfigActionResult> {
  const parsed = produtoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const diretor = await exigirDiretorDe(parsed.data.emitente_id);
  if (!diretor) return { ok: false, error: "Apenas o diretor desta empresa pode alterar." };

  const row = {
    ...parsed.data,
    codigo: parsed.data.codigo?.trim() || null,
    descricao: parsed.data.descricao?.trim() || null,
    linha: parsed.data.linha?.trim() || null,
    categoria_id: parsed.data.categoria_id || null,
    atualizado_em: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (input.id) {
    // não permite mover produto entre empresas por aqui
    const { error } = await supabase
      .from("produtos")
      .update(row)
      .eq("id", input.id)
      .eq("emitente_id", parsed.data.emitente_id);
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
  const supabase = await createClient();
  const { data: p } = await supabase.from("produtos").select("emitente_id").eq("id", id).maybeSingle();
  if (!p) return { ok: false, error: "Produto não encontrado." };
  const diretor = await exigirDiretorDe(p.emitente_id);
  if (!diretor) return { ok: false, error: "Apenas o diretor desta empresa pode alterar." };
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
  emitenteId: z.uuid().optional().nullable(),
});

export async function salvarComentarioPresidencia(
  mes: string,
  texto: string,
  emitenteId?: string | null,
): Promise<ConfigActionState> {
  const diretor = await exigirDiretorEmAlguma();
  if (!diretor) {
    return { error: "Apenas o diretor pode salvar o comentário." };
  }

  const parsed = comentarioSchema.safeParse({ mes, texto, emitenteId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const chave = chaveComentarioPresidencia(parsed.data.mes, parsed.data.emitenteId ?? null);
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
