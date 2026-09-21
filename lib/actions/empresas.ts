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

export type EmpresaListaItem = {
  id: string;
  nome: string;
  cidade: string | null;
  segmento: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  qtdAbertas: number;
  ultimoContato: string | null;
};

export type EmpresaIndicadores = {
  aberto: number;
  vendido: number;
  perdido: number;
  qtdNegociacoes: number;
  ticketMedio: number | null;
  cicloMedioDias: number | null;
  ultimoContato: string | null;
};

export type EmpresaDetalhe = {
  id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  segmento: string | null;
  tipoSegmento: "publico" | "privado" | "ppp" | null;
  cnpj: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  observacoes: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  indicadores: EmpresaIndicadores;
};

export type EmpresaActionResult =
  | { ok: true; empresa: EmpresaResumo }
  | { ok: false; error: string };

function podeEditarEmpresa(
  usuario: { id: string; ehDiretorEmAlguma: boolean },
  responsavelId: string | null,
): boolean {
  return (
    usuario.ehDiretorEmAlguma ||
    responsavelId == null ||
    responsavelId === usuario.id
  );
}

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

  const municipio = parsed.data.municipio ?? parsed.data.cidade ?? null;
  const cidade = parsed.data.cidade ?? parsed.data.municipio ?? null;

  const { data: criada, error: erroInsert } = await supabase
    .from("empresas")
    .insert({
      nome,
      cidade,
      uf: parsed.data.uf,
      segmento: parsed.data.segmento,
      tipo_segmento: parsed.data.tipo_segmento ?? null,
      cnpj: parsed.data.cnpj,
      responsavel_id: parsed.data.responsavel_id ?? usuario.id,
      observacoes: parsed.data.observacoes,
      logradouro: parsed.data.logradouro ?? null,
      numero: parsed.data.numero ?? null,
      complemento: parsed.data.complemento ?? null,
      bairro: parsed.data.bairro ?? null,
      cep: parsed.data.cep ?? null,
      municipio,
    })
    .select("id, nome, cidade, segmento")
    .single();

  if (erroInsert) {
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
  revalidatePath("/contatos");
  return { ok: true, empresa: criada };
}

export async function atualizarEmpresa(
  empresaId: string,
  input: z.input<typeof empresaSchema>,
): Promise<EmpresaActionResult | { ok: true; empresaId: string }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(empresaId);
  if (!idParsed.success) return { ok: false, error: "Empresa inválida." };

  const parsed = empresaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const { data: atual, error: erroAtual } = await supabase
    .from("empresas")
    .select("id, responsavel_id, arquivado_em")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (erroAtual || !atual || atual.arquivado_em) {
    return { ok: false, error: "Empresa não encontrada." };
  }

  if (!podeEditarEmpresa(usuario, atual.responsavel_id)) {
    return {
      ok: false,
      error: "Sem permissão para editar esta empresa.",
    };
  }

  const podeAlterarResp =
    usuario.ehDiretorEmAlguma ||
    atual.responsavel_id == null ||
    atual.responsavel_id === usuario.id;

  const municipio = parsed.data.municipio ?? parsed.data.cidade ?? null;
  const cidade = parsed.data.cidade ?? parsed.data.municipio ?? null;

  const { data: atualizada, error: erroUpdate } = await supabase
    .from("empresas")
    .update({
      nome: parsed.data.nome.trim(),
      cidade,
      uf: parsed.data.uf,
      segmento: parsed.data.segmento,
      ...(parsed.data.tipo_segmento !== undefined
        ? { tipo_segmento: parsed.data.tipo_segmento }
        : {}),
      cnpj: parsed.data.cnpj,
      observacoes: parsed.data.observacoes,
      logradouro: parsed.data.logradouro ?? null,
      numero: parsed.data.numero ?? null,
      complemento: parsed.data.complemento ?? null,
      bairro: parsed.data.bairro ?? null,
      cep: parsed.data.cep ?? null,
      municipio,
      ...(podeAlterarResp && parsed.data.responsavel_id !== undefined
        ? { responsavel_id: parsed.data.responsavel_id }
        : {}),
    })
    .eq("id", atual.id)
    .select("id, nome, cidade, segmento")
    .maybeSingle();

  if (erroUpdate) return { ok: false, error: erroUpdate.message };
  if (!atualizada) {
    return { ok: false, error: "Sem permissão para editar esta empresa." };
  }

  revalidatePath("/empresas");
  revalidatePath(`/empresas/${atual.id}`);
  revalidatePath("/contatos");

  return { ok: true, empresa: atualizada };
}

/** Arquivar empresa (R14). */
export async function arquivarEmpresa(
  empresaId: string,
): Promise<{ ok: true; empresaId: string } | { ok: false; error: string }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(empresaId);
  if (!idParsed.success) return { ok: false, error: "Empresa inválida." };

  const supabase = await createClient();
  const { data: empresa, error } = await supabase
    .from("empresas")
    .select("id, responsavel_id, arquivado_em")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (error || !empresa) {
    return { ok: false, error: "Empresa não encontrada." };
  }
  if (empresa.arquivado_em) {
    return { ok: true, empresaId: empresa.id };
  }

  if (!podeEditarEmpresa(usuario, empresa.responsavel_id)) {
    return { ok: false, error: "Sem permissão para arquivar." };
  }

  const { error: erroUpdate } = await supabase
    .from("empresas")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", empresa.id);

  if (erroUpdate) return { ok: false, error: erroUpdate.message };

  revalidatePath("/empresas");
  revalidatePath(`/empresas/${empresa.id}`);
  revalidatePath("/contatos");

  return { ok: true, empresaId: empresa.id };
}
