import { z } from "zod";

export const situacaoOrcamentoSchema = z.enum([
  "enviado",
  "aprovado",
  "recusado",
  "substituido",
]);

export const origemOrcamentoSchema = z.enum(["upload", "gerado"]);

/** Orçamento — SPEC 3.2 `orcamentos` (+ colunas da alteração). */
export const orcamentoSchema = z.object({
  negociacao_id: z.uuid("Negociação é obrigatória"),
  numero: z.string().trim().optional().nullable(),
  valor: z.coerce.number().nonnegative("Valor é obrigatório"),
  enviado_em: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional(),
  validade: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional()
    .nullable(),
  arquivo_path: z.string().trim().optional().nullable(),
  situacao: situacaoOrcamentoSchema.default("enviado"),
  origem: origemOrcamentoSchema.default("upload"),
  titulo: z.string().trim().optional().nullable(),
  condicoes_pagamento: z.string().trim().optional().nullable(),
  prazo_entrega: z.string().trim().optional().nullable(),
  frete: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
  desconto_geral_pct: z.coerce.number().min(0).max(100).default(0),
  subtotal: z.coerce.number().nonnegative().optional().nullable(),
  arquivo_pdf_path: z.string().trim().optional().nullable(),
  arquivo_xlsx_path: z.string().trim().optional().nullable(),
});

export type OrcamentoInput = z.infer<typeof orcamentoSchema>;
