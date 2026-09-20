"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

export type MetaRow = {
  responsavel_id: string;
  mes: string; // yyyy-mm-01
  valor: number;
};

export type MetasAno = {
  ano: number;
  vendedores: { id: string; nome: string; ativo: boolean; perfil: string }[];
  metas: MetaRow[];
};

async function exigirDiretor() {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.perfil !== "diretor" || !usuario.ativo) return null;
  return usuario;
}

export async function listarMetasAno(ano: number): Promise<MetasAno | null> {
  const diretor = await exigirDiretor();
  if (!diretor) return null;

  const supabase = await createClient();
  const [{ data: usuarios }, { data: metas }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nome, ativo, perfil")
      .order("nome"),
    supabase
      .from("metas")
      .select("responsavel_id, mes, valor")
      .gte("mes", `${ano}-01-01`)
      .lte("mes", `${ano}-12-01`),
  ]);

  return {
    ano,
    vendedores: (usuarios ?? []).filter((u) => u.ativo || (metas ?? []).some((m) => m.responsavel_id === u.id)),
    metas: (metas ?? []).map((m) => ({
      responsavel_id: m.responsavel_id,
      mes: String(m.mes).slice(0, 10),
      valor: Number(m.valor ?? 0),
    })),
  };
}

const salvarSchema = z.object({
  responsavel_id: z.uuid(),
  mes: z.string().regex(/^\d{4}-\d{2}-01$/),
  valor: z.coerce.number().min(0).max(999_999_999),
});

export async function salvarMeta(
  input: z.input<typeof salvarSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode definir metas." };

  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("metas")
    .upsert(
      {
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

/** Copia as metas de um mês para todos os meses seguintes do mesmo ano. */
export async function replicarMetaAno(input: {
  ano: number;
  mesOrigem: number;
}): Promise<{ ok: true; copiadas: number } | { ok: false; error: string }> {
  const diretor = await exigirDiretor();
  if (!diretor) return { ok: false, error: "Apenas o diretor pode definir metas." };

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
    .eq("mes", origem);

  const linhas = [];
  for (const m of base ?? []) {
    for (let k = mesOrigem + 1; k <= 12; k++) {
      linhas.push({
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
