import { z } from "zod";

/** Cadastro/edição de contato — SPEC 3.2 `contatos` (obrigatórios: empresa_id, nome). */
export const contatoSchema = z.object({
  empresa_id: z.uuid("Empresa é obrigatória"),
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  whatsapp: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z
      .string()
      .trim()
      .regex(/^\d+$/, "WhatsApp só dígitos com DDI")
      .nullable(),
  ),
  email: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.email("E-mail inválido").nullable(),
  ),
  cargo: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().nullable(),
  ),
  decisor: z.boolean().default(false),
});

export type ContatoInput = z.infer<typeof contatoSchema>;
