import { z } from "zod";

import { tipoAcaoSchema } from "./acao";
import { tipoInteracaoSchema } from "./interacao";

export const buscarEmpresaArgsSchema = z.object({
  texto: z.string().trim().min(1),
});

export const criarEmpresaArgsSchema = z.object({
  nome: z.string().trim().min(1),
  cidade: z.string().trim().optional().nullable(),
  uf: z
    .string()
    .trim()
    .length(2)
    .toUpperCase()
    .optional()
    .nullable(),
  segmento: z.string().trim().optional().nullable(),
  contato: z
    .object({
      nome: z.string().trim().min(1),
      whatsapp: z.string().trim().optional().nullable(),
      cargo: z.string().trim().optional().nullable(),
    })
    .optional()
    .nullable(),
});

/** Empresa vendedora (nome ou id). Omitida = todas (leitura) ou a única do usuário (escrita). */
export const empresaVendedoraArg = z.string().trim().min(1).optional();

export const listarEmpresasVendedorasArgsSchema = z.object({});

export const listarNegociacoesArgsSchema = z.object({
  empresa_vendedora: empresaVendedoraArg,
  status: z.enum(["aberta", "vendida", "perdida"]).optional(),
  funil: z.string().trim().optional(),
  etapa: z.string().trim().optional(),
  responsavel_email: z.string().trim().email().optional(),
  parada_ha_dias: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().min(1).max(100).default(30),
});

export const obterNegociacaoArgsSchema = z.object({
  id: z.uuid(),
});

export const criarNegociacaoArgsSchema = z
  .object({
    empresa_vendedora: empresaVendedoraArg,
    empresa_id: z.uuid().optional(),
    empresa_nome: z.string().trim().min(1).optional(),
    valor_estimado: z.coerce.number().nonnegative(),
    funil: z.string().trim().optional(),
    linha: z.string().trim().optional().nullable(),
    origem: z.string().trim().optional().nullable(),
    temperatura: z.coerce
      .number()
      .int()
      .refine((v) => v === 1 || v === 2 || v === 3)
      .default(2),
    previsao_mes: z
      .string()
      .regex(/^\d{4}-\d{2}(-\d{2})?$/)
      .optional()
      .nullable(),
    proxima_acao: z
      .object({
        descricao: z.string().trim().min(1),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        tipo: tipoAcaoSchema.optional(),
      })
      .optional()
      .nullable(),
  })
  .refine((v) => Boolean(v.empresa_id || v.empresa_nome), {
    message: "Informe empresa_id ou empresa_nome.",
  });

export const registrarInteracaoArgsSchema = z.object({
  negociacao_id: z.uuid(),
  tipo: tipoInteracaoSchema.exclude(["sistema"]),
  texto: z.string().optional(),
});

export const criarAcaoArgsSchema = z.object({
  negociacao_id: z.uuid(),
  descricao: z.string().trim().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo: tipoAcaoSchema.optional(),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional()
    .nullable(),
});

export const concluirAcaoArgsSchema = z.object({
  acao_id: z.uuid(),
  proxima: z
    .object({
      descricao: z.string().trim().min(1),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional()
    .nullable(),
});

export const moverEtapaArgsSchema = z.object({
  negociacao_id: z.uuid(),
  etapa: z.string().trim().min(1),
});

export const fecharNegociacaoArgsSchema = z.object({
  negociacao_id: z.uuid(),
  resultado: z.enum(["vendida", "perdida"]),
  valor_final: z.coerce.number().nonnegative().optional(),
  motivo: z.string().trim().optional(),
  anotacao: z.string().trim().optional(),
});

export const relatorioPresidenciaArgsSchema = z.object({
  empresa_vendedora: empresaVendedoraArg,
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const previsaoArgsSchema = z.object({
  empresa_vendedora: empresaVendedoraArg,
  meses: z.coerce.number().int().min(1).max(12).default(3),
});

export const buscarProdutoArgsSchema = z.object({
  empresa_vendedora: empresaVendedoraArg,
  texto: z.string().trim().min(1),
});

export const montarOrcamentoArgsSchema = z.object({
  negociacao_id: z.uuid(),
  itens: z
    .array(
      z.object({
        produto_id: z.uuid().optional(),
        descricao: z.string().trim().optional(),
        quantidade: z.coerce.number().positive(),
        preco_unitario: z.coerce.number().nonnegative().optional(),
        desconto_pct: z.coerce.number().min(0).max(100).optional(),
      }),
    )
    .min(1),
  condicoes_pagamento: z.string().trim().optional().nullable(),
  prazo_entrega: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});
