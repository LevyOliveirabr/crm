"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { exigirDiretorDe } from "@/lib/auth/permissoes-server";
import { createClient } from "@/lib/supabase/server";

export type MetaRow = {
  responsavel_id: string;
  mes: string; // yyyy-mm-01
  valor: number;
};

export type MetasAno = {
  ano: number;
  emitenteId: string;
  emitenteNome: string;
  /** Empresas em que o usuário é diretor (para o seletor). */
  emitentes: { id: string; nome: string }[];
  vendedores: { id: string; nome: string; ativo: boolean; perfil: string }[];
  metas: MetaRow[];
};

/**
 * Metas de um ano numa empresa vendedora. Se `emitenteId` não vier, usa a
 * primeira empresa em que o usuário é diretor.
 */
export async function listarMetasAno(
  ano: number,
  emitenteId?: string | null,
): Promise<MetasAno | null> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;
  const emitentes = usuario.empresas
    .filter((e) => e.perfil === "diretor")
    .map((e) => ({ id: e.id, nome: e.nome }));
  if (emitentes.length === 0) return null;
  const alvo = emitentes.find((e) => e.id === emitenteId) ?? emitentes[0]!;

  const supabase = await createClient();
  type Membro = {
    usuario_id: string;
    perfil: string;
    usuarios: { id: string; nome: string; ativo: boolean } | { id: string; nome: string; ativo: boolean }[] | null;
  };
  const [{ data: membros }, { data: metas }] = await Promise.all([
    supabase
      .from("usuario_emitentes")
      .select("usuario_id, perfil, usuarios:usuario_id ( id, nome, ativo )")
      .eq("emitente_id", alvo.id),
    supabase
      .from("metas")
      .select("responsavel_id, mes, valor")
      .eq("emitente_id", alvo.id)
      .gte("mes", `${ano}-01-01`)
      .lte("mes", `${ano}-12-01`),
  ]);

  const vendedores = ((membros ?? []) as unknown as Membro[])
    .map((m) => {
      const u = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios;
      return u ? { id: u.id, nome: u.nome, ativo: u.ativo, perfil: m.perfil } : null;
    })
    .filter((u): u is NonNullable<typeof u> => u != null)
    .filter((u) => u.ativo || (metas ?? []).some((m) => m.responsavel_id === u.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    ano,
    emitenteId: alvo.id,
    emitenteNome: alvo.nome,
    emitentes,
    vendedores,
    metas: (metas ?? []).map((m) => ({
      responsavel_id: m.responsavel_id,
      mes: String(m.mes).slice(0, 10),
      valor: Number(m.valor ?? 0),
    })),
  };
}

const salvarSchema = z.object({
  emitente_id: z.uuid(),
  responsavel_id: z.uuid(),
  mes: z.string().regex(/^\d{4}-\d{2}-01$/),
  valor: z.coerce.number().min(0).max(999_999_999),
});

export async function salvarMeta(
  input: z.input<typeof salvarSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const diretor = await exigirDiretorDe(parsed.data.emitente_id);
  if (!diretor) return { ok: false, error: "Apenas o diretor da empresa pode definir metas." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("metas")
    .upsert(
      {
        emitente_id: parsed.data.emitente_id,
        responsavel_id: parsed.data.responsavel_id,
        mes: parsed.data.mes,
        valor: parsed.data.valor,
      },
      { onConflict: "responsavel_id,emitente_id,mes" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes/metas");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  return { ok: true };
}

/** Copia as metas de um mês para todos os meses seguintes do mesmo ano (na empresa). */
export async function replicarMetaAno(input: {
  emitenteId: string;
  ano: number;
  mesOrigem: number;
}): Promise<{ ok: true; copiadas: number } | { ok: false; error: string }> {
  const diretor = await exigirDiretorDe(input.emitenteId);
  if (!diretor) return { ok: false, error: "Apenas o diretor da empresa pode definir metas." };

  const ano = Math.round(Number(input.ano));
  const mesOrigem = Math.round(Number(input.mesOrigem));
  if (!Number.isFinite(ano) || mesOrigem < 1 || mesOrigem > 12) {
    return { ok: false, error: "Mês inválido." };
  }

  const supabase = await createClient();
  const origem = `${ano}-${String(mesOrigem).padStart(2, "0")}-01`;
  const { data: base } = await supabase
    .from("metas")
    .select("responsavel_id, valor")
    .eq("emitente_id", input.emitenteId)
    .eq("mes", origem);

  const linhas = [];
  for (const m of base ?? []) {
    for (let k = mesOrigem + 1; k <= 12; k++) {
      linhas.push({
        emitente_id: input.emitenteId,
        responsavel_id: m.responsavel_id,
        mes: `${ano}-${String(k).padStart(2, "0")}-01`,
        valor: Number(m.valor ?? 0),
      });
    }
  }
  if (linhas.length === 0) return { ok: true, copiadas: 0 };

  const { error } = await supabase
    .from("metas")
    .upsert(linhas, { onConflict: "responsavel_id,emitente_id,mes" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes/metas");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  return { ok: true, copiadas: linhas.length };
}
