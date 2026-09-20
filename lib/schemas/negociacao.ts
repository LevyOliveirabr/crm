import { z } from "zod";

export const statusNegociacaoSchema = z.enum(["aberta", "vendida", "perdida"]);

/** Cadastro/edição de negociação — SPEC 3.2 `negociacoes`. */
export const negociacaoSchema = z.object({
  empresa_id: z.uuid("Empresa é obrigatória"),
  emitente_id: z.uuid("Empresa vendedora é obrigatória"),
  contato_id: z.uuid().optional().nullable(),
  funil_id: z.uuid("Funil é obrigatório"),
  etapa_id: z.uuid("Etapa é obrigatória"),
  titulo: z.string().trim().min(1, "Título é obrigatório"),
  linha: z.string().trim().optional().nullable(),
  origem: z.string().trim().optional().nullable(),
  valor_estimado: z.coerce.number().nonnegative().default(0),
  temperatura: z.coerce
    .number()
    .int()
    .refine((v) => v === 1 || v === 2 || v === 3, "Temperatura inválida")
    .default(2),
  previsao_mes: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional()
    .nullable(),
  responsavel_id: z.uuid("Responsável é obrigatório"),
  status: statusNegociacaoSchema.default("aberta"),
  valor_final: z.coerce.number().nonnegative().optional().nullable(),
  motivo_perda: z.string().trim().optional().nullable(),
  anotacao_fechamento: z.string().trim().optional().nullable(),
});

export type NegociacaoInput = z.infer<typeof negociacaoSchema>;
