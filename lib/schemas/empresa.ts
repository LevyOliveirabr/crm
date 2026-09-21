import { z } from "zod";

import { apenasDigitosCnpj, formatarCnpj, validarCnpj } from "@/lib/cnpj";

const textoOpcional = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().trim().nullable(),
);

/** CNPJ opcional: null se vazio; se preenchido, mascara e valida dígitos. */
export const cnpjOpcionalSchema = z.preprocess(
  (v) => {
    if (v === "" || v === undefined || v === null) return null;
    const d = apenasDigitosCnpj(String(v));
    if (!d) return null;
    return formatarCnpj(d);
  },
  z
    .string()
    .nullable()
    .refine((v) => v == null || validarCnpj(v), "CNPJ inválido"),
);

export const enderecoCamposSchema = {
  logradouro: textoOpcional,
  numero: textoOpcional,
  complemento: textoOpcional,
  bairro: textoOpcional,
  cep: z.preprocess(
    (v) => {
      if (v === "" || v === undefined || v === null) return null;
      const d = String(v).replace(/\D/g, "").slice(0, 8);
      if (!d) return null;
      if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
      return d;
    },
    z
      .string()
      .nullable()
      .refine((v) => v == null || /^\d{5}-\d{3}$/.test(v), "CEP inválido"),
  ),
  municipio: textoOpcional,
};

/** Cadastro/edição de empresa — SPEC 3.2 + 3.8 (obrigatório: nome). */
export const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  cidade: textoOpcional,
  uf: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().length(2, "UF deve ter 2 letras").toUpperCase().nullable(),
  ),
  segmento: textoOpcional,
  tipo_segmento: z
    .preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.enum(["publico", "privado", "ppp"]).nullable(),
    )
    .optional(),
  cnpj: cnpjOpcionalSchema,
  responsavel_id: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.uuid().nullable(),
  ).optional(),
  observacoes: textoOpcional,
  ...enderecoCamposSchema,
});

export type EmpresaInput = z.infer<typeof empresaSchema>;
