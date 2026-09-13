import { z } from "zod";

/** Produto — SPEC 3.2 `produtos` (obrigatório: nome). */
export const produtoSchema = z.object({
  codigo: z.string().trim().optional().nullable(),
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  descricao: z.string().trim().optional().nullable(),
  linha: z.string().trim().optional().nullable(),
  unidade: z.string().trim().min(1).default("un"),
  preco_base: z.coerce.number().nonnegative().default(0),
  ativo: z.boolean().default(true),
});

export type ProdutoInput = z.infer<typeof produtoSchema>;
