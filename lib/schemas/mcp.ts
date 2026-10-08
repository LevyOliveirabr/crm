import { z } from "zod";

import { apenasDigitosCnpj, formatarCnpj, validarCnpj } from "@/lib/cnpj";
import {
  CAMPOS_CONTATO_MCP,
  CAMPOS_EMPRESA_MCP,
  colunasPresentes,
} from "@/lib/empresas/cadastro";

import { tipoAcaoSchema } from "./acao";
import { tipoInteracaoSchema } from "./interacao";

/** Ausente permanece ausente; "" e null limpam o campo. */
function textoParcial(max = 500) {
  return z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t === "" ? null : t;
    },
    z.string().max(max).nullable().optional(),
  );
}

const emailParcial = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== "string") return v;
    const t = v.trim().toLowerCase();
    return t === "" ? null : t;
  },
  z.union([z.email("E-mail inválido"), z.null()]).optional(),
);

const ufParcial = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== "string") return v;
    const t = v.trim().toUpperCase();
    return t === "" ? null : t;
  },
  z.union([z.string().length(2, "UF deve ter 2 letras"), z.null()]).optional(),
);

/** CEP com ou sem máscara. Exatamente 8 dígitos; grava 00000-000. */
const cepParcial = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== "string") return v;
    const cru = v.trim();
    if (cru === "") return null;
    const d = cru.replace(/\D/g, "");
    if (d.length !== 8) return cru;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
  },
  z
    .union([
      z.string().regex(/^\d{5}-\d{3}$/, "CEP inválido"),
      z.null(),
    ])
    .optional(),
);

/** CNPJ com ou sem máscara. Dígitos verificadores; grava 00.000.000/0000-00. */
const cnpjParcial = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== "string") return v;
    const cru = v.trim();
    if (cru === "") return null;
    const d = apenasDigitosCnpj(cru);
    if (!d) return null;
    return d.length === 14 ? formatarCnpj(d) : cru;
  },
  z
    .union([
      z.string().refine((valor) => validarCnpj(valor), "CNPJ inválido"),
      z.null(),
    ])
    .optional(),
);

const whatsappParcial = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== "string") return v;
    const d = v.replace(/\D/g, "");
    return d === "" ? null : d;
  },
  z
    .union([
      z
        .string()
        .regex(/^\d{10,15}$/, "WhatsApp só dígitos com DDI (10 a 15)"),
      z.null(),
    ])
    .optional(),
);

/** "sim" / "não" (também boolean). Ausente não altera. */
const principalParcial = z.preprocess(
  (v) => {
    if (v === undefined || v === null || v === "") return undefined;
    if (v === true || v === "sim" || v === "Sim" || v === "SIM") return true;
    if (
      v === false ||
      v === "nao" ||
      v === "não" ||
      v === "Nao" ||
      v === "Não" ||
      v === "NAO"
    ) {
      return false;
    }
    return v;
  },
  z.boolean({ error: "principal deve ser sim ou não" }).optional(),
);

const camposEmpresaParciais = {
  nome: z.string().trim().min(1, "Nome é obrigatório").optional(),
  razao_social: textoParcial(),
  nome_fantasia: textoParcial(),
  cnpj: cnpjParcial,
  inscricao_estadual: textoParcial(30),
  logradouro: textoParcial(),
  numero: textoParcial(20),
  complemento: textoParcial(),
  bairro: textoParcial(),
  cep: cepParcial,
  cidade: textoParcial(),
  uf: ufParcial,
  telefone: textoParcial(40),
  email: emailParcial,
  site: textoParcial(),
  atividade_principal: textoParcial(),
  observacoes: textoParcial(4000),
  segmento: textoParcial(),
};

const contatoOpcionalSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome do contato é obrigatório"),
    cargo: textoParcial(),
    telefone: textoParcial(40),
    whatsapp: whatsappParcial,
    email: emailParcial,
    principal: principalParcial,
  })
  .optional()
  .nullable();

export const buscarEmpresaArgsSchema = z.object({
  texto: z.string().trim().min(1),
});

export const criarEmpresaArgsSchema = z.object({
  ...camposEmpresaParciais,
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  contato: contatoOpcionalSchema,
});

export const atualizarEmpresaArgsSchema = z
  .object({
    empresa_id: z.uuid(),
    ...camposEmpresaParciais,
  })
  .refine((v) => colunasPresentes(v, CAMPOS_EMPRESA_MCP).length > 0, {
    message: "Informe ao menos um campo para alterar.",
  });

export const obterEmpresaArgsSchema = z.object({
  id: z.uuid(),
});

const camposContatoParciais = {
  nome: z.string().trim().min(1, "Nome é obrigatório").optional(),
  cargo: textoParcial(),
  telefone: textoParcial(40),
  whatsapp: whatsappParcial,
  email: emailParcial,
  principal: principalParcial,
};

export const adicionarContatoArgsSchema = z.object({
  empresa_id: z.uuid(),
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  cargo: textoParcial(),
  telefone: textoParcial(40),
  whatsapp: whatsappParcial,
  email: emailParcial,
  principal: principalParcial,
});

export const atualizarContatoArgsSchema = z
  .object({
    contato_id: z.uuid(),
    ...camposContatoParciais,
  })
  .refine((v) => colunasPresentes(v, CAMPOS_CONTATO_MCP).length > 0, {
    message: "Informe ao menos um campo para alterar.",
  });

/** Empresa vendedora (nome ou id). Omitida = todas (leitura) ou a única do usuário (escrita). */
export const empresaVendedoraArg = z.string().trim().min(1).optional();

export const listarEmpresasVendedorasArgsSchema = z.object({});

export const listarNegociacoesArgsSchema = z.object({
  empresa_vendedora: empresaVendedoraArg,
  status: z.enum(["aberta", "vendida", "perdida"]).optional(),
  funil: z.string().trim().optional(),
  etapa: z.string().trim().optional(),
  responsavel_email: z.string().trim().email().optional(),
  parada_ha_dias: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().min(1).max(100).default(30),
});

export const obterNegociacaoArgsSchema = z.object({
  id: z.uuid(),
});

export const criarNegociacaoArgsSchema = z
  .object({
    empresa_vendedora: empresaVendedoraArg,
    empresa_id: z.uuid().optional(),
    empresa_nome: z.string().trim().min(1).optional(),
    valor_estimado: z.coerce.number().nonnegative(),
    funil: z.string().trim().optional(),
    linha: z.string().trim().optional().nullable(),
    origem: z.string().trim().optional().nullable(),
    temperatura: z.coerce
      .number()
      .int()
      .refine((v) => v === 1 || v === 2 || v === 3)
      .default(2),
    previsao_mes: z
      .string()
      .regex(/^\d{4}-\d{2}(-\d{2})?$/)
      .optional()
      .nullable(),
    proxima_acao: z
      .object({
        descricao: z.string().trim().min(1),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        tipo: tipoAcaoSchema.optional(),
      })
      .optional()
      .nullable(),
  })
  .refine((v) => Boolean(v.empresa_id || v.empresa_nome), {
    message: "Informe empresa_id ou empresa_nome.",
  });

export const registrarInteracaoArgsSchema = z.object({
  negociacao_id: z.uuid(),
  tipo: tipoInteracaoSchema.exclude(["sistema"]),
  texto: z.string().optional(),
});

export const criarAcaoArgsSchema = z.object({
  negociacao_id: z.uuid(),
  descricao: z.string().trim().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo: tipoAcaoSchema.optional(),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional()
    .nullable(),
});

export const concluirAcaoArgsSchema = z.object({
  acao_id: z.uuid(),
  proxima: z
    .object({
      descricao: z.string().trim().min(1),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional()
    .nullable(),
});

export const moverEtapaArgsSchema = z.object({
  negociacao_id: z.uuid(),
  etapa: z.string().trim().min(1),
});

export const fecharNegociacaoArgsSchema = z.object({
  negociacao_id: z.uuid(),
  resultado: z.enum(["vendida", "perdida"]),
  valor_final: z.coerce.number().nonnegative().optional(),
  motivo: z.string().trim().optional(),
  anotacao: z.string().trim().optional(),
});

export const relatorioPresidenciaArgsSchema = z.object({
  empresa_vendedora: empresaVendedoraArg,
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const previsaoArgsSchema = z.object({
  empresa_vendedora: empresaVendedoraArg,
  meses: z.coerce.number().int().min(1).max(12).default(3),
});

export const buscarProdutoArgsSchema = z.object({
  empresa_vendedora: empresaVendedoraArg,
  texto: z.string().trim().min(1),
});

export const montarOrcamentoArgsSchema = z.object({
  negociacao_id: z.uuid(),
  itens: z
    .array(
      z.object({
        produto_id: z.uuid().optional(),
        descricao: z.string().trim().optional(),
        quantidade: z.coerce.number().positive(),
        preco_unitario: z.coerce.number().nonnegative().optional(),
        desconto_pct: z.coerce.number().min(0).max(100).optional(),
      }),
    )
    .min(1),
  condicoes_pagamento: z.string().trim().optional().nullable(),
  prazo_entrega: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});
