"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { ehDiretorDe, ehMembroDe } from "@/lib/auth/permissoes";
import {
  inicioMesAtualISO,
  inicioProximoMesISO,
  parseMoedaBR,
} from "@/lib/format";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type NegociacaoActionResult =
  | {
      ok: true;
      precisaProximaAcao?: boolean;
      negociacaoId?: string;
    }
  | { ok: false; error: string };

const moverEtapaSchema = z.object({
  negociacaoId: z.uuid("Negociação inválida"),
  etapaId: z.uuid("Etapa inválida"),
});

const criarNegociacaoSchema = z.object({
  empresa_id: z.uuid("Empresa é obrigatória"),
  emitente_id: z.uuid("Empresa vendedora é obrigatória"),
  valor_estimado: z.coerce.number().nonnegative().default(0),
  valor_previsao: z.coerce.number().nonnegative().optional().nullable(),
  negocio_unico: z.boolean().default(true),
  funil_id: z.uuid("Funil é obrigatório"),
  linha: z.string().trim().optional().nullable(),
  titulo: z.string().trim().optional().nullable(),
  origem: z.string().trim().optional().nullable(),
  temperatura: z.coerce
    .number()
    .int()
    .refine((v) => v === 1 || v === 2 || v === 3)
    .default(2),
  previsao_mes: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  previsao_data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  contato_id: z.uuid().optional().nullable(),
  proxima_acao: z
    .object({
      descricao: z.string().trim().min(1),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tipo: z
        .enum(["ligar", "whatsapp", "visita", "reuniao", "proposta", "outro"])
        .default("ligar"),
    })
    .optional()
    .nullable(),
});

const CAMPOS_EDITAVEIS = [
  "titulo",
  "valor_estimado",
  "valor_previsao",
  "negocio_unico",
  "temperatura",
  "responsavel_id",
  "linha",
  "origem",
  "previsao_mes",
  "previsao_data",
  "data_faturamento",
  "categoria_forecast",
  "contato_id",
] as const;

type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number];

const atualizarCampoSchema = z.object({
  negociacaoId: z.uuid(),
  campo: z.enum(CAMPOS_EDITAVEIS),
  valor: z.unknown(),
});

const marcarVendaSchema = z.object({
  negociacaoId: z.uuid(),
  valor_final: z.coerce.number().nonnegative("Valor final é obrigatório"),
  previsao_mes: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

const marcarPerdaSchema = z.object({
  negociacaoId: z.uuid(),
  motivo_perda: z.string().trim().min(1, "Motivo da perda é obrigatório"),
  anotacao_fechamento: z.string().trim().optional().nullable(),
});

function revalidarNegociacao(id: string) {
  revalidatePath(`/negociacoes/${id}`);
  revalidatePath("/funil");
  revalidatePath("/hoje");
  revalidatePath("/dashboard");
}

/** Move a negociação para outra etapa (R3). O trigger grava interação `sistema`. */
export async function moverEtapa(
  negociacaoId: string,
  etapaId: string,
): Promise<NegociacaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = moverEtapaSchema.safeParse({ negociacaoId, etapaId });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();

  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, funil_id, etapa_id, status, arquivado_em")
    .eq("id", parsed.data.negociacaoId)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }
  if (negociacao.arquivado_em) {
    return { ok: false, error: "Negociação arquivada." };
  }
  if (negociacao.status !== "aberta") {
    return { ok: false, error: "Só é possível mover negociações abertas." };
  }

  if (negociacao.etapa_id === parsed.data.etapaId) {
    return { ok: true, negociacaoId: negociacao.id };
  }

  const { data: etapa, error: erroEtapa } = await supabase
    .from("etapas")
    .select("id, funil_id, ativo")
    .eq("id", parsed.data.etapaId)
    .maybeSingle();

  if (erroEtapa || !etapa || !etapa.ativo) {
    return { ok: false, error: "Etapa não encontrada." };
  }
  if (etapa.funil_id !== negociacao.funil_id) {
    return { ok: false, error: "Etapa não pertence ao funil da negociação." };
  }

  const { error: erroUpdate } = await supabase
    .from("negociacoes")
    .update({ etapa_id: parsed.data.etapaId })
    .eq("id", negociacao.id);

  if (erroUpdate) {
    return { ok: false, error: erroUpdate.message };
  }

  const { count, error: erroCount } = await supabase
    .from("acoes")
    .select("id", { count: "exact", head: true })
    .eq("negociacao_id", negociacao.id)
    .is("concluida_em", null);

  if (erroCount) {
    return { ok: false, error: erroCount.message };
  }

  const precisaProximaAcao = (count ?? 0) === 0;

  revalidarNegociacao(negociacao.id);

  return {
    ok: true,
    precisaProximaAcao,
    negociacaoId: negociacao.id,
  };
}

/** Cria negociação (R1/R2) e redireciona para a ficha. */
export async function criarNegociacao(
  input: z.input<typeof criarNegociacaoSchema>,
): Promise<NegociacaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = criarNegociacaoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const data = parsed.data;

  if (!ehMembroDe(usuario, data.emitente_id)) {
    return { ok: false, error: "Você não participa desta empresa vendedora." };
  }

  const { data: empresa, error: erroEmp } = await supabase
    .from("empresas")
    .select("id, nome")
    .eq("id", data.empresa_id)
    .is("arquivado_em", null)
    .maybeSingle();

  if (erroEmp || !empresa) {
    return { ok: false, error: "Empresa não encontrada." };
  }

  const { data: etapa, error: erroEtapa } = await supabase
    .from("etapas")
    .select("id")
    .eq("funil_id", data.funil_id)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (erroEtapa || !etapa) {
    return { ok: false, error: "Funil sem etapas ativas." };
  }

  const linha = data.linha?.trim() || null;
  const tituloSugerido = linha
    ? `[${linha}] ${empresa.nome}`
    : empresa.nome;
  const titulo = data.titulo?.trim() || tituloSugerido;
  const previsaoData = data.previsao_data ?? null;
  const previsao = previsaoData
    ? `${previsaoData.slice(0, 7)}-01`
    : data.previsao_mes
      ? `${data.previsao_mes.slice(0, 7)}-01`
      : inicioProximoMesISO();

  const { data: criada, error: erroInsert } = await supabase
    .from("negociacoes")
    .insert({
      empresa_id: empresa.id,
      emitente_id: data.emitente_id,
      contato_id: data.contato_id ?? null,
      funil_id: data.funil_id,
      etapa_id: etapa.id,
      titulo,
      linha,
      origem: data.origem?.trim() || null,
      valor_estimado: data.valor_estimado,
      valor_previsao: data.valor_previsao ?? null,
      negocio_unico: data.negocio_unico ?? true,
      temperatura: data.temperatura ?? 2,
      previsao_mes: previsao,
      previsao_data: previsaoData,
      responsavel_id: usuario.id,
      status: "aberta",
    })
    .select("id")
    .single();

  if (erroInsert || !criada) {
    return { ok: false, error: erroInsert?.message ?? "Falha ao criar." };
  }

  if (data.proxima_acao?.descricao) {
    const { error: erroAcao } = await supabase.from("acoes").insert({
      negociacao_id: criada.id,
      descricao: data.proxima_acao.descricao,
      tipo: data.proxima_acao.tipo ?? "ligar",
      data: data.proxima_acao.data,
      responsavel_id: usuario.id,
    });
    if (erroAcao) {
      return { ok: false, error: erroAcao.message };
    }
  }

  revalidarNegociacao(criada.id);
  redirect(`/negociacoes/${criada.id}`);
}

/** Atualiza um campo inline (sem botão Salvar global). */
export async function atualizarCampo(
  negociacaoId: string,
  campo: CampoEditavel,
  valor: unknown,
): Promise<NegociacaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = atualizarCampoSchema.safeParse({
    negociacaoId,
    campo,
    valor,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, responsavel_id, status, arquivado_em, emitente_id")
    .eq("id", parsed.data.negociacaoId)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }
  if (negociacao.arquivado_em) {
    return { ok: false, error: "Negociação arquivada." };
  }

  if (
    parsed.data.campo === "responsavel_id" &&
    !ehDiretorDe(usuario, negociacao.emitente_id)
  ) {
    return { ok: false, error: "Só o diretor da empresa pode transferir responsável." };
  }
  if (parsed.data.campo === "responsavel_id") {
    const novoId = String(parsed.data.valor ?? "");
    const { data: vinculo } = await supabase
      .from("usuario_emitentes")
      .select("usuario_id")
      .eq("usuario_id", novoId)
      .eq("emitente_id", negociacao.emitente_id)
      .maybeSingle();
    if (!vinculo) {
      return { ok: false, error: "O novo responsável não participa desta empresa vendedora." };
    }
  }

  const patch: Database["public"]["Tables"]["negociacoes"]["Update"] = {};

  switch (parsed.data.campo) {
    case "titulo": {
      const t = String(parsed.data.valor ?? "").trim();
      if (!t) return { ok: false, error: "Título é obrigatório." };
      patch.titulo = t;
      break;
    }
    case "valor_estimado": {
      const n =
        typeof parsed.data.valor === "number"
          ? parsed.data.valor
          : parseMoedaBR(String(parsed.data.valor ?? ""));
      if (n == null || n < 0) {
        return { ok: false, error: "Valor inválido." };
      }
      patch.valor_estimado = n;
      break;
    }
    case "valor_previsao": {
      if (parsed.data.valor == null || parsed.data.valor === "") {
        patch.valor_previsao = null;
        break;
      }
      const n =
        typeof parsed.data.valor === "number"
          ? parsed.data.valor
          : parseMoedaBR(String(parsed.data.valor ?? ""));
      if (n == null || n < 0) {
        return { ok: false, error: "Valor previsão inválido." };
      }
      patch.valor_previsao = n;
      break;
    }
    case "negocio_unico": {
      patch.negocio_unico = Boolean(parsed.data.valor);
      break;
    }
    case "temperatura": {
      const t = Number(parsed.data.valor);
      if (![1, 2, 3].includes(t)) {
        return { ok: false, error: "Temperatura inválida." };
      }
      patch.temperatura = t;
      break;
    }
    case "responsavel_id": {
      const id = z.uuid().safeParse(parsed.data.valor);
      if (!id.success) return { ok: false, error: "Responsável inválido." };
      patch.responsavel_id = id.data;
      break;
    }
    case "linha":
    case "origem": {
      const s = String(parsed.data.valor ?? "").trim();
      patch[parsed.data.campo] = s || null;
      break;
    }
    case "previsao_mes": {
      const s = String(parsed.data.valor ?? "").trim();
      if (!s) {
        patch.previsao_mes = null;
      } else {
        const m = s.match(/^(\d{4})-(\d{2})/);
        if (!m) return { ok: false, error: "Mês inválido." };
        patch.previsao_mes = `${m[1]}-${m[2]}-01`;
      }
      break;
    }
    case "previsao_data": {
      const s = String(parsed.data.valor ?? "").trim();
      if (!s) {
        patch.previsao_data = null;
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T12:00:00Z`))) {
          return { ok: false, error: "Data de fechamento inválida." };
        }
        patch.previsao_data = s;
        patch.previsao_mes = `${s.slice(0, 7)}-01`;
      }
      break;
    }
    case "categoria_forecast": {
      const s = String(parsed.data.valor ?? "").trim();
      if (!s) {
        patch.categoria_forecast = null;
      } else if (s === "compromisso" || s === "provavel" || s === "possivel") {
        patch.categoria_forecast = s;
      } else {
        return { ok: false, error: "Categoria de forecast inválida." };
      }
      break;
    }
    case "data_faturamento": {
      const s = String(parsed.data.valor ?? "").trim();
      if (!s) {
        patch.data_faturamento = null;
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T12:00:00Z`))) {
          return { ok: false, error: "Data de faturamento inválida." };
        }
        patch.data_faturamento = s;
      }
      break;
    }
    case "contato_id": {
      if (parsed.data.valor == null || parsed.data.valor === "") {
        patch.contato_id = null;
      } else {
        const id = z.uuid().safeParse(parsed.data.valor);
        if (!id.success) return { ok: false, error: "Contato inválido." };
        patch.contato_id = id.data;
      }
      break;
    }
  }

  const { error: erroUpdate } = await supabase
    .from("negociacoes")
    .update(patch)
    .eq("id", negociacao.id);

  if (erroUpdate) return { ok: false, error: erroUpdate.message };

  revalidarNegociacao(negociacao.id);
  return { ok: true, negociacaoId: negociacao.id };
}

/** Marcar venda (R7). */
export async function marcarVenda(
  negociacaoId: string,
  valorFinal: number,
  previsaoMes?: string | null,
): Promise<NegociacaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = marcarVendaSchema.safeParse({
    negociacaoId,
    valor_final: valorFinal,
    previsao_mes: previsaoMes,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, status, arquivado_em")
    .eq("id", parsed.data.negociacaoId)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }
  if (negociacao.arquivado_em) {
    return { ok: false, error: "Negociação arquivada." };
  }
  if (negociacao.status !== "aberta") {
    return { ok: false, error: "Negociação já está fechada." };
  }

  const mes =
    parsed.data.previsao_mes?.match(/^(\d{4})-(\d{2})/)
      ? `${parsed.data.previsao_mes.slice(0, 7)}-01`
      : inicioMesAtualISO();

  const agora = new Date().toISOString();

  const { error: erroUpdate } = await supabase
    .from("negociacoes")
    .update({
      status: "vendida",
      valor_final: parsed.data.valor_final,
      previsao_mes: mes,
      fechado_em: agora,
      motivo_perda: null,
    })
    .eq("id", negociacao.id);

  if (erroUpdate) return { ok: false, error: erroUpdate.message };

  await supabase
    .from("acoes")
    .update({ concluida_em: agora })
    .eq("negociacao_id", negociacao.id)
    .is("concluida_em", null);

  const { data: orcRecente } = await supabase
    .from("orcamentos")
    .select("id")
    .eq("negociacao_id", negociacao.id)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orcRecente) {
    await supabase
      .from("orcamentos")
      .update({ situacao: "aprovado" })
      .eq("id", orcRecente.id);
  }

  revalidarNegociacao(negociacao.id);
  return { ok: true, negociacaoId: negociacao.id };
}

/** Marcar perda (R8). */
export async function marcarPerda(
  negociacaoId: string,
  motivoPerda: string,
  anotacao?: string | null,
): Promise<NegociacaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = marcarPerdaSchema.safeParse({
    negociacaoId,
    motivo_perda: motivoPerda,
    anotacao_fechamento: anotacao,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, status, arquivado_em")
    .eq("id", parsed.data.negociacaoId)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }
  if (negociacao.arquivado_em) {
    return { ok: false, error: "Negociação arquivada." };
  }
  if (negociacao.status !== "aberta") {
    return { ok: false, error: "Negociação já está fechada." };
  }

  const agora = new Date().toISOString();

  const { error: erroUpdate } = await supabase
    .from("negociacoes")
    .update({
      status: "perdida",
      motivo_perda: parsed.data.motivo_perda,
      anotacao_fechamento: parsed.data.anotacao_fechamento?.trim() || null,
      fechado_em: agora,
      valor_final: null,
    })
    .eq("id", negociacao.id);

  if (erroUpdate) return { ok: false, error: erroUpdate.message };

  await supabase
    .from("acoes")
    .update({ concluida_em: agora })
    .eq("negociacao_id", negociacao.id)
    .is("concluida_em", null);

  const { data: orcRecente } = await supabase
    .from("orcamentos")
    .select("id")
    .eq("negociacao_id", negociacao.id)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orcRecente) {
    await supabase
      .from("orcamentos")
      .update({ situacao: "recusado" })
      .eq("id", orcRecente.id);
  }

  revalidarNegociacao(negociacao.id);
  return { ok: true, negociacaoId: negociacao.id };
}

/** Reabrir (R9): diretor ou responsável. Mantém etapa. */
export async function reabrir(
  negociacaoId: string,
): Promise<NegociacaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(negociacaoId);
  if (!idParsed.success) return { ok: false, error: "Negociação inválida." };

  const supabase = await createClient();
  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, status, responsavel_id, arquivado_em, etapa_id, emitente_id")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }
  if (negociacao.arquivado_em) {
    return { ok: false, error: "Negociação arquivada." };
  }
  if (negociacao.status === "aberta") {
    return { ok: true, negociacaoId: negociacao.id };
  }

  if (
    !ehDiretorDe(usuario, negociacao.emitente_id) &&
    negociacao.responsavel_id !== usuario.id
  ) {
    return { ok: false, error: "Sem permissão para reabrir." };
  }

  const { error: erroUpdate } = await supabase
    .from("negociacoes")
    .update({
      status: "aberta",
      fechado_em: null,
      valor_final: null,
      motivo_perda: null,
      anotacao_fechamento: null,
      // mantém etapa_id
    })
    .eq("id", negociacao.id);

  if (erroUpdate) return { ok: false, error: erroUpdate.message };

  revalidarNegociacao(negociacao.id);
  return { ok: true, negociacaoId: negociacao.id };
}

/** Arquivar (R14) — soft delete. */
export async function arquivar(
  negociacaoId: string,
): Promise<NegociacaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(negociacaoId);
  if (!idParsed.success) return { ok: false, error: "Negociação inválida." };

  const supabase = await createClient();
  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, responsavel_id, arquivado_em, emitente_id")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }
  if (negociacao.arquivado_em) {
    return { ok: true, negociacaoId: negociacao.id };
  }

  if (
    !ehDiretorDe(usuario, negociacao.emitente_id) &&
    negociacao.responsavel_id !== usuario.id
  ) {
    return { ok: false, error: "Sem permissão para arquivar." };
  }

  const { error: erroUpdate } = await supabase
    .from("negociacoes")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", negociacao.id);

  if (erroUpdate) return { ok: false, error: erroUpdate.message };

  revalidatePath("/funil");
  revalidatePath("/hoje");
  revalidatePath("/dashboard");
  revalidatePath(`/negociacoes/${negociacao.id}`);

  return { ok: true, negociacaoId: negociacao.id };
}

/**
 * Excluir definitivamente (R14). Só o diretor.
 * Apaga a negociação e, por cascade, interações, ações, orçamentos, itens e
 * histórico de etapas. Os arquivos dos orçamentos no Storage são removidos
 * antes, para não ficarem órfãos.
 */
export async function excluirNegociacao(
  negociacaoId: string,
): Promise<NegociacaoActionResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const idParsed = z.uuid().safeParse(negociacaoId);
  if (!idParsed.success) return { ok: false, error: "Negociação inválida." };

  const supabase = await createClient();
  const { data: negociacao, error: erroNeg } = await supabase
    .from("negociacoes")
    .select("id, emitente_id")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (erroNeg || !negociacao) {
    return { ok: false, error: "Negociação não encontrada." };
  }

  if (!ehDiretorDe(usuario, negociacao.emitente_id)) {
    return {
      ok: false,
      error: "Só o diretor da empresa pode excluir. Use Arquivar para tirar da tela.",
    };
  }

  const { data: orcamentos, error: erroOrc } = await supabase
    .from("orcamentos")
    .select("arquivo_path, arquivo_pdf_path, arquivo_xlsx_path")
    .eq("negociacao_id", negociacao.id);

  if (erroOrc) return { ok: false, error: erroOrc.message };

  const arquivos = (orcamentos ?? [])
    .flatMap((o) => [o.arquivo_path, o.arquivo_pdf_path, o.arquivo_xlsx_path])
    .filter((p): p is string => Boolean(p));

  if (arquivos.length > 0) {
    const { error: erroStorage } = await supabase.storage
      .from("orcamentos")
      .remove(arquivos);
    if (erroStorage) {
      return {
        ok: false,
        error: `Falha ao remover arquivos de orçamento: ${erroStorage.message}`,
      };
    }
  }

  const { error: erroDelete } = await supabase
    .from("negociacoes")
    .delete()
    .eq("id", negociacao.id);

  if (erroDelete) return { ok: false, error: erroDelete.message };

  revalidatePath("/funil");
  revalidatePath("/hoje");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath(`/negociacoes/${negociacao.id}`);

  return { ok: true, negociacaoId: negociacao.id };
}
