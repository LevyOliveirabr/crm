"use server";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { apenasDigitosCnpj, formatarCnpj, validarCnpj } from "@/lib/cnpj";

export type DadosCnpj = {
  cnpj: string; // formatado 00.000.000/0000-00
  razaoSocial: string;
  nomeFantasia: string | null;
  cidade: string | null;
  uf: string | null;
  situacao: string | null;
  atividadePrincipal: string | null;
  telefone: string | null;
  email: string | null;
};

export type ConsultaCnpjResult =
  | { ok: true; dados: DadosCnpj }
  | { ok: false; error: string };

function titulo(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p.length <= 2 && !/^[a-z]{2}$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ")
    .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
}

/**
 * Consulta dados públicos do CNPJ na BrasilAPI (base da Receita Federal).
 * Não grava nada: o formulário decide quais campos preencher.
 */
export async function consultarCnpj(cnpj: string): Promise<ConsultaCnpjResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const d = apenasDigitosCnpj(cnpj ?? "");
  if (!validarCnpj(d)) return { ok: false, error: "CNPJ inválido." };

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, error: "CNPJ não encontrado na Receita." };
    if (!res.ok) return { ok: false, error: `Consulta indisponível (${res.status}). Tente de novo.` };

    const j = (await res.json()) as Record<string, unknown>;
    const str = (k: string) => (typeof j[k] === "string" ? (j[k] as string) : null);

    return {
      ok: true,
      dados: {
        cnpj: formatarCnpj(d),
        razaoSocial: titulo(str("razao_social")) ?? "",
        nomeFantasia: titulo(str("nome_fantasia")),
        cidade: titulo(str("municipio")),
        uf: str("uf")?.toUpperCase() ?? null,
        situacao: titulo(str("descricao_situacao_cadastral")),
        atividadePrincipal: titulo(str("cnae_fiscal_descricao")),
        telefone: str("ddd_telefone_1"),
        email: str("email")?.toLowerCase() ?? null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === "TimeoutError"
          ? "A consulta demorou demais. Tente de novo."
          : "Falha ao consultar o CNPJ.",
    };
  }
}
