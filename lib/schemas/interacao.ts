import { z } from "zod";

export const tipoInteracaoSchema = z.enum([
  "ligacao",
  "whatsapp",
  "visita",
  "reuniao",
  "email",
  "anotacao",
  "sistema",
]);

/** Interação da timeline — SPEC 3.2 `interacoes` (obrigatórios: negociacao_id, tipo). */
export const interacaoSchema = z.object({
  negociacao_id: z.uuid("Negociação é obrigatória"),
  tipo: tipoInteracaoSchema,
  texto: z.string().trim().optional().nullable(),
  usuario_id: z.uuid().optional().nullable(),
  origem_agente: z.boolean().default(false),
});

export type InteracaoInput = z.infer<typeof interacaoSchema>;
