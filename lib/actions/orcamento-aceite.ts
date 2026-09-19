"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAppUrl } from "@/lib/app-url";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { formatarMoeda, hojeISO } from "@/lib/format";
import { gerarTokenAceite, verificarTokenAceite } from "@/lib/orcamentos/aceite-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Gera o link público de aceite (só quem enxerga o orçamento pela RLS). */
export async function gerarLinkAceite(
  orcamentoId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };
  if (!z.uuid().safeParse(orcamentoId).success) {
    return { ok: false, error: "Orçamento inválido." };
  }

  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orcamentos")
    .select("id, situacao")
    .eq("id", orcamentoId)
    .maybeSingle();
  if (!o) return { ok: false, error: "Orçamento não encontrado." };
  if (o.situacao !== "enviado" && o.situacao !== "aprovado") {
    return { ok: false, error: "Só orçamentos enviados podem ter link de aceite." };
  }

  try {
    const token = await gerarTokenAceite(o.id);
    return { ok: true, url: `${getAppUrl()}/aceite/${token}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao gerar link." };
  }
}

const aceitarSchema = z.object({
  token: z.string().min(10),
  nome: z.string().trim().min(2, "Informe seu nome.").max(120),
});

/**
 * Aceite pelo cliente (sem login). O token assinado identifica o orçamento;
 * grava situação, quem aceitou e uma interação na negociação.
 */
export async function aceitarOrcamentoPorToken(input: {
  token: string;
  nome: string;
}): Promise<{ ok: true; jaAceito: boolean } | { ok: false; error: string }> {
  const parsed = aceitarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const orcamentoId = await verificarTokenAceite(parsed.data.token);
  if (!orcamentoId) return { ok: false, error: "Link inválido ou expirado." };

  const admin = createAdminClient();
  const { data: o } = await admin
    .from("orcamentos")
    .select("id, numero, valor, situacao, validade, aceito_em, negociacao_id")
    .eq("id", orcamentoId)
    .maybeSingle();
  if (!o) return { ok: false, error: "Orçamento não encontrado." };
  if (o.aceito_em) return { ok: true, jaAceito: true };
  if (o.situacao !== "enviado") {
    return { ok: false, error: "Este orçamento não está mais disponível para aceite." };
  }
  if (o.validade && o.validade < hojeISO()) {
    return { ok: false, error: "Este orçamento venceu. Peça uma nova versão ao vendedor." };
  }

  const agora = new Date().toISOString();
  const { error } = await admin
    .from("orcamentos")
    .update({ situacao: "aprovado", aceito_em: agora, aceito_por: parsed.data.nome })
    .eq("id", o.id);
  if (error) return { ok: false, error: error.message };

  await admin.from("interacoes").insert({
    negociacao_id: o.negociacao_id,
    tipo: "sistema",
    texto: `Orçamento ${o.numero ?? ""} (${formatarMoeda(Number(o.valor))}) aceito pelo cliente via link por ${parsed.data.nome}.`.replace(/\s+/g, " "),
    usuario_id: null,
  });

  revalidatePath(`/negociacoes/${o.negociacao_id}`);
  revalidatePath(`/orcamentos/${o.id}`);
  revalidatePath("/dashboard");
  return { ok: true, jaAceito: false };
}
