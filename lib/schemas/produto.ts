import { z } from "zod";

import { urlOpcional } from "./emitente";

/** Produto — SPEC 3.2 `produtos` + multi-empresa (obrigatório: nome, empresa vendedora). */
export const produtoSchema = z.object({
  emitente_id: z.uuid("Empresa vendedora é obrigatória"),
  codigo: z.string().trim().optional().nullable(),
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  descricao: z.string().trim().optional().nullable(),
  linha: z.string().trim().optional().nullable(),
  categoria_id: z.uuid().optional().nullable(),
  unidade: z.string().trim().min(1).default("un"),
  preco_base: z.coerce.number().nonnegative().default(0),
  /** Página do produto no site da empresa. */
  link: urlOpcional,
  /** Catálogo hospedado fora (alternativa ao arquivo anexado). */
  catalogo_url: urlOpcional,
  ativo: z.boolean().default(true),
});

export type ProdutoInput = z.infer<typeof produtoSchema>;
