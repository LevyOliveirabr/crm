"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { adicionarDiasISO } from "@/lib/format";
import { acaoSchema, tipoAcaoSchema } from "@/lib/schemas/acao";
import { createClient } from "@/lib/supabase/server";

export type AcaoActionResult =
  | {
      ok: true;
      precisaProximaAcao?: boolean;
      negociacaoId?: string;
    }
  | { ok: false; error: string };

const criarSchema = acaoSchema
  .omit({ responsavel_id: true })
  .extend({
    tipo: tipoAcaoSchema.default("ligar"),
    responsavel_id: z.uuid().optional(),
  });

async function revalidarTelasAcao() {
  revalidatePath("/hoje");
  revalidatePath("/funil");
}

/** Conclui a ação e indica se a UI deve abrir o mini-form (R4). */
export async function concluirAcao(id: string): Promise<AcaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Ação inválida." };

  const supabase = await createClient();

  const { data: acao, error: erroBusca } = await supabase
    .from("acoes")
    .select("id, negociacao_id, concluida_em")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (erroBusca || !acao) {
    return { ok: false, error: "Ação não encontrada." };
  }
  if (acao.concluida_em) {
    return { ok: false, error: "Ação já concluída." };
  }

  const { error: erroUpdate } = await supabase
    .from("acoes")
    .update({ concluida_em: new Date().toISOString() })
    .eq("id", acao.id);

  if (erroUpdate) {
    return { ok: false, error: erroUpdate.message };
  }

  const { count, error: erroCount } = await supabase
    .from("acoes")
    .select("id", { count: "exact", head: true })
    .eq("negociacao_id", acao.negociacao_id)
    .is("concluida_em", null);

  if (erroCount) {
    return { ok: false, error: erroCount.message };
  }

  const precisaProximaAcao = (count ?? 0) === 0;

  await revalidarTelasAcao();
  revalidatePath(`/negociacoes/${acao.negociacao_id}`);

  return {
    ok: true,
    precisaProximaAcao,
    negociacaoId: acao.negociacao_id,
  };
}

/** Adia a data da ação em `dias` dias. */
export async function adiarAcao(
  id: string,
  dias: number,
): Promise<AcaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Ação inválida." };

  const diasParsed = z.number().int().min(1).max(365).safeParse(dias);
  if (!diasParsed.success) return { ok: false, error: "Dias inválidos." };

  const supabase = await createClient();

  const { data: acao, error: erroBusca } = await supabase
    .from("acoes")
    .select("id, data, concluida_em, negociacao_id")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (erroBusca || !acao) {
    return { ok: false, error: "Ação não encontrada." };
  }
  if (acao.concluida_em) {
    return { ok: false, error: "Ação já concluída." };
  }

  const novaData = adicionarDiasISO(acao.data, diasParsed.data);

  const { error: erroUpdate } = await supabase
    .from("acoes")
    .update({ data: novaData })
    .eq("id", acao.id);

  if (erroUpdate) {
    return { ok: false, error: erroUpdate.message };
  }

  await revalidarTelasAcao();
  revalidatePath(`/negociacoes/${acao.negociacao_id}`);

  return { ok: true };
}

/** Cria próxima ação (mini-form e demais telas). */
export async function criarAcao(
  input: z.input<typeof criarSchema>,
): Promise<AcaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();

  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, responsavel_id, status")
    .eq("id", parsed.data.negociacao_id)
    .is("arquivado_em", null)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }

  const responsavelId =
    parsed.data.responsavel_id ?? negociacao.responsavel_id ?? usuario.id;

  const { error: erroInsert } = await supabase.from("acoes").insert({
    negociacao_id: parsed.data.negociacao_id,
    descricao: parsed.data.descricao,
    tipo: parsed.data.tipo,
    data: parsed.data.data,
    hora: parsed.data.hora ?? null,
    responsavel_id: responsavelId,
  });

  if (erroInsert) {
    return { ok: false, error: erroInsert.message };
  }

  await revalidarTelasAcao();
  revalidatePath(`/negociacoes/${parsed.data.negociacao_id}`);

  return { ok: true };
}

const atualizarSchema = z.object({
  id: z.uuid("Ação inválida"),
  descricao: z.string().trim().min(1, "Descrição é obrigatória"),
  tipo: tipoAcaoSchema.optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

/** Edita ação pendente (ficha). */
export async function atualizarAcao(
  input: z.input<typeof atualizarSchema>,
): Promise<AcaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = atualizarSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const { data: acao, error: erroBusca } = await supabase
    .from("acoes")
    .select("id, negociacao_id, concluida_em")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (erroBusca || !acao) {
    return { ok: false, error: "Ação não encontrada." };
  }
  if (acao.concluida_em) {
    return { ok: false, error: "Ação já concluída." };
  }

  const patch: {
    descricao: string;
    data: string;
    tipo?: z.infer<typeof tipoAcaoSchema>;
  } = {
    descricao: parsed.data.descricao,
    data: parsed.data.data,
  };
  if (parsed.data.tipo) patch.tipo = parsed.data.tipo;

  const { error: erroUpdate } = await supabase
    .from("acoes")
    .update(patch)
    .eq("id", acao.id);

  if (erroUpdate) {
    return { ok: false, error: erroUpdate.message };
  }

  await revalidarTelasAcao();
  revalidatePath(`/negociacoes/${acao.negociacao_id}`);

  return { ok: true, negociacaoId: acao.negociacao_id };
}
