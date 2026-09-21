"use server";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { apenasDigitosCnpj, formatarCnpj, validarCnpj } from "@/lib/cnpj";
import { formatarCep } from "@/lib/endereco";

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
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
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

function str(j: Record<string, unknown>, k: string): string | null {
  return typeof j[k] === "string" ? (j[k] as string) : null;
}

function mapBrasilApi(j: Record<string, unknown>, d: string): DadosCnpj {
  const cepRaw = str(j, "cep");
  const municipio = titulo(str(j, "municipio"));
  return {
    cnpj: formatarCnpj(d),
    razaoSocial: titulo(str(j, "razao_social")) ?? "",
    nomeFantasia: titulo(str(j, "nome_fantasia")),
    cidade: municipio,
    uf: str(j, "uf")?.toUpperCase() ?? null,
    situacao: titulo(str(j, "descricao_situacao_cadastral")),
    atividadePrincipal: titulo(str(j, "cnae_fiscal_descricao")),
    telefone: str(j, "ddd_telefone_1"),
    email: str(j, "email")?.toLowerCase() ?? null,
    logradouro: titulo(str(j, "logradouro")),
    numero: str(j, "numero")?.trim() || null,
    complemento: titulo(str(j, "complemento")),
    bairro: titulo(str(j, "bairro")),
    cep: cepRaw ? formatarCep(cepRaw) : null,
    municipio,
  };
}

function mapOpenCnpj(j: Record<string, unknown>, d: string): DadosCnpj {
  const cepRaw = str(j, "cep") ?? str(j, "address_zip");
  const municipio =
    titulo(str(j, "municipio")) ??
    titulo(str(j, "city")) ??
    titulo(str(j, "municipality"));
  return {
    cnpj: formatarCnpj(d),
    razaoSocial:
      titulo(str(j, "razao_social")) ??
      titulo(str(j, "company_name")) ??
      "",
    nomeFantasia:
      titulo(str(j, "nome_fantasia")) ?? titulo(str(j, "trading_name")),
    cidade: municipio,
    uf: (str(j, "uf") ?? str(j, "state"))?.toUpperCase() ?? null,
    situacao:
      titulo(str(j, "descricao_situacao_cadastral")) ??
      titulo(str(j, "registration_status")),
    atividadePrincipal:
      titulo(str(j, "cnae_fiscal_descricao")) ??
      titulo(str(j, "main_activity")),
    telefone: str(j, "ddd_telefone_1") ?? str(j, "phone"),
    email: (str(j, "email") ?? "").toLowerCase() || null,
    logradouro:
      titulo(str(j, "logradouro")) ?? titulo(str(j, "street")),
    numero: str(j, "numero")?.trim() || str(j, "number")?.trim() || null,
    complemento:
      titulo(str(j, "complemento")) ?? titulo(str(j, "complement")),
    bairro: titulo(str(j, "bairro")) ?? titulo(str(j, "district")),
    cep: cepRaw ? formatarCep(cepRaw) : null,
    municipio,
  };
}

async function fetchJson(
  url: string,
  timeoutMs: number,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; status: number } | { ok: false; timeout: true } | { ok: false; network: true }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status };
    const json = (await res.json()) as Record<string, unknown>;
    return { ok: true, json };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { ok: false, timeout: true };
    }
    return { ok: false, network: true };
  }
}

/**
 * Consulta dados públicos do CNPJ (BrasilAPI, com fallback OpenCNPJ).
 * Não grava nada: o formulário decide quais campos preencher.
 */
export async function consultarCnpj(cnpj: string): Promise<ConsultaCnpjResult> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const d = apenasDigitosCnpj(cnpj ?? "");
  if (!validarCnpj(d)) return { ok: false, error: "CNPJ inválido." };

  const brasil = await fetchJson(
    `https://brasilapi.com.br/api/cnpj/v1/${d}`,
    8_000,
  );
  if (brasil.ok) {
    return { ok: true, dados: mapBrasilApi(brasil.json, d) };
  }
  if ("status" in brasil && brasil.status === 404) {
    return { ok: false, error: "CNPJ não encontrado na Receita." };
  }

  const open = await fetchJson(`https://api.opencnpj.org/${d}`, 8_000);
  if (open.ok) {
    return { ok: true, dados: mapOpenCnpj(open.json, d) };
  }
  if ("status" in open && open.status === 404) {
    return { ok: false, error: "CNPJ não encontrado na Receita." };
  }

  if (
    ("timeout" in brasil && brasil.timeout) ||
    ("timeout" in open && open.timeout)
  ) {
    return { ok: false, error: "A consulta demorou demais. Tente de novo." };
  }

  return {
    ok: false,
    error: "Consulta indisponível no momento. Tente de novo em instantes.",
  };
}
