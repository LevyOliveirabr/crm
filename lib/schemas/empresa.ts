import { z } from "zod";

/** Cadastro/edição de empresa — SPEC 3.2 `empresas` (obrigatório: nome). */
export const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  cidade: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().nullable(),
  ),
  uf: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().length(2, "UF deve ter 2 letras").toUpperCase().nullable(),
  ),
  segmento: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().nullable(),
  ),
  cnpj: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().nullable(),
  ),
  responsavel_id: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.uuid().nullable(),
  ),
  observacoes: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().nullable(),
  ),
});

export type EmpresaInput = z.infer<typeof empresaSchema>;
