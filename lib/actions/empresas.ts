"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { normalizarNome } from "@/lib/format";
import { empresaSchema } from "@/lib/schemas/empresa";
import { createClient } from "@/lib/supabase/server";

export type EmpresaResumo = {
  id: string;
  nome: string;
  cidade: string | null;
  segmento: string | null;
};

export type EmpresaActionResult =
  | { ok: true; empresa: EmpresaResumo }
  | { ok: false; error: string };

/** Busca empresas por nome (ilike, mín. 2 letras). R11. */
export async function buscarEmpresas(
  termo: string,
): Promise<{ ok: true; empresas: EmpresaResumo[] } | { ok: false; error: string }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const q = termo.trim();
  if (q.length < 2) return { ok: true, empresas: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nome, cidade, segmento")
    .is("arquivado_em", null)
    .ilike("nome", `%${q}%`)
    .order("nome")
    .limit(12);

  if (error) return { ok: false, error: error.message };

  // Preferir match exato sem acento no topo (ex.: "Remo engenharia")
  const alvo = normalizarNome(q);
  const ordenadas = [...(data ?? [])].sort((a, b) => {
    const aExact = normalizarNome(a.nome) === alvo ? 0 : 1;
    const bExact = normalizarNome(b.nome) === alvo ? 0 : 1;
    return aExact - bExact || a.nome.localeCompare(b.nome, "pt-BR");
  });

  return { ok: true, empresas: ordenadas };
}

/**
 * Cria empresa ou reutiliza existente com mesmo nome (case/acento-insensitive). R11.
 */
export async function criarEmpresa(
  input: z.input<typeof empresaSchema>,
): Promise<EmpresaActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = empresaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const nome = parsed.data.nome.trim();
  const alvo = normalizarNome(nome);

  // Busca candidatos e compara sem acento (R11)
  const { data: candidatas, error: erroBusca } = await supabase
    .from("empresas")
    .select("id, nome, cidade, segmento")
    .is("arquivado_em", null)
    .ilike("nome", `%${nome.slice(0, Math.min(nome.length, 24))}%`)
    .limit(40);

  if (erroBusca) return { ok: false, error: erroBusca.message };

  const existente = (candidatas ?? []).find(
    (e) => normalizarNome(e.nome) === alvo,
  );
  if (existente) {
    return { ok: true, empresa: existente };
  }

  // Fallback amplo se o ilike parcial falhar por acento
  const { data: todas, error: erroTodas } = await supabase
    .from("empresas")
    .select("id, nome, cidade, segmento")
    .is("arquivado_em", null)
    .limit(500);

  if (erroTodas) return { ok: false, error: erroTodas.message };

  const existenteAmplo = (todas ?? []).find(
    (e) => normalizarNome(e.nome) === alvo,
  );
  if (existenteAmplo) {
    return { ok: true, empresa: existenteAmplo };
  }

  const { data: criada, error: erroInsert } = await supabase
    .from("empresas")
    .insert({
      nome,
      cidade: parsed.data.cidade,
      uf: parsed.data.uf,
      segmento: parsed.data.segmento,
      cnpj: parsed.data.cnpj,
      responsavel_id: parsed.data.responsavel_id ?? usuario.id,
      observacoes: parsed.data.observacoes,
    })
    .select("id, nome, cidade, segmento")
    .single();

  if (erroInsert) {
    // Corrida com índice único: busca de novo
    if (erroInsert.code === "23505") {
      const { data: dup } = await supabase
        .from("empresas")
        .select("id, nome, cidade, segmento")
        .is("arquivado_em", null)
        .limit(500);
      const hit = (dup ?? []).find((e) => normalizarNome(e.nome) === alvo);
      if (hit) return { ok: true, empresa: hit };
    }
    return { ok: false, error: erroInsert.message };
  }

  revalidatePath("/empresas");
  return { ok: true, empresa: criada };
}
