import { z } from "zod";

import { cnpjOpcionalSchema, enderecoCamposSchema } from "@/lib/schemas/empresa";

const urlOpcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v == null || /^https?:\/\//i.test(v), "Informe uma URL começando com http:// ou https://");

const textoOpcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

/** Empresa vendedora (emitente dos orçamentos). */
export const emitenteSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(60),
  razao_social: z.string().trim().min(1, "Razão social é obrigatória"),
  cnpj: cnpjOpcionalSchema,
  endereco: textoOpcional,
  telefone: textoOpcional,
  email: textoOpcional,
  site: urlOpcional,
  validade_padrao_dias: z.coerce.number().int().positive().default(15),
  condicoes_pagamento_padrao: textoOpcional,
  prazo_entrega_padrao: textoOpcional,
  rodape: textoOpcional,
  orcamento_prefixo: z.string().trim().min(1).max(20).default("ORC"),
  ativo: z.boolean().default(true),
  ...enderecoCamposSchema,
});

export type EmitenteInput = z.infer<typeof emitenteSchema>;

/** Categoria de produto (por empresa vendedora), com catálogo opcional. */
export const categoriaProdutoSchema = z.object({
  emitente_id: z.uuid("Empresa vendedora é obrigatória"),
  nome: z.string().trim().min(1, "Nome é obrigatório").max(80),
  descricao: z.string().trim().optional().nullable(),
  catalogo_url: urlOpcional,
  ativo: z.boolean().default(true),
});

export type CategoriaProdutoInput = z.infer<typeof categoriaProdutoSchema>;

export { urlOpcional };
