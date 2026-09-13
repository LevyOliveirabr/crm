import { z } from "zod";

export const tipoAcaoSchema = z.enum([
  "ligar",
  "whatsapp",
  "visita",
  "reuniao",
  "proposta",
  "outro",
]);

/** Próxima ação — SPEC 3.2 `acoes` (obrigatórios: negociacao_id, descricao, data, responsavel_id). */
export const acaoSchema = z.object({
  negociacao_id: z.uuid("Negociação é obrigatória"),
  descricao: z.string().trim().min(1, "Descrição é obrigatória"),
  tipo: tipoAcaoSchema.default("ligar"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  responsavel_id: z.uuid("Responsável é obrigatório"),
});

export type AcaoInput = z.infer<typeof acaoSchema>;
