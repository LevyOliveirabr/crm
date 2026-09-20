/**
 * Núcleo puro do escopo de empresa vendedora (sem next/headers): usado pelas
 * páginas, pelo route handler de exportação e pelo MCP. Testável em vitest.
 */
import type { EmpresaDoUsuario } from "@/lib/auth/get-usuario-atual";

export const COOKIE_EMITENTE = "crm_emitente";
export const VALOR_TODAS = "todas";

export type EscopoEmpresa = {
  /** null = todas as empresas do usuário (sem filtro; a RLS limita). */
  emitenteId: string | null;
  emitente: EmpresaDoUsuario | null;
  /** Empresas que o usuário pode escolher. */
  empresas: EmpresaDoUsuario[];
  /** true quando o usuário só participa de uma empresa (seletor oculto). */
  fixo: boolean;
  /** true quando o ?emitente= da URL não é uma empresa do usuário. */
  paramInvalido: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizar(v: string | string[] | null | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  const t = (s ?? "").trim();
  return t ? t : null;
}

/**
 * Resolve o escopo: `param` (?emitente=) tem prioridade sobre `cookie`.
 * Valores fora das empresas do usuário são ignorados (cai para "todas").
 */
export function resolverEscopo(
  empresas: EmpresaDoUsuario[],
  entrada: { param?: string | string[] | null; cookie?: string | null } = {},
): EscopoEmpresa {
  const lista = empresas.filter((e) => e.ativo);
  const porId = new Map(lista.map((e) => [e.id, e]));

  if (lista.length === 1) {
    const unica = lista[0]!;
    return {
      emitenteId: unica.id,
      emitente: unica,
      empresas: lista,
      fixo: true,
      paramInvalido: false,
    };
  }

  const param = normalizar(entrada.param);
  let paramInvalido = false;
  let escolhido: string | null | undefined;

  if (param) {
    if (param.toLowerCase() === VALOR_TODAS) {
      escolhido = null;
    } else if (UUID_RE.test(param) && porId.has(param)) {
      escolhido = param;
    } else {
      paramInvalido = true;
    }
  }

  if (escolhido === undefined) {
    const cookie = normalizar(entrada.cookie);
    if (cookie && cookie.toLowerCase() !== VALOR_TODAS && porId.has(cookie)) {
      escolhido = cookie;
    } else {
      escolhido = null;
    }
  }

  return {
    emitenteId: escolhido,
    emitente: escolhido ? (porId.get(escolhido) ?? null) : null,
    empresas: lista,
    fixo: false,
    paramInvalido,
  };
}

/** Resolve um texto (id ou nome, sem acento/caixa) para uma empresa do usuário. */
export function encontrarEmpresa(
  empresas: EmpresaDoUsuario[],
  texto: string | null | undefined,
): EmpresaDoUsuario | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  const direta = empresas.find((e) => e.id === t);
  if (direta) return direta;
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const alvo = norm(t);
  return (
    empresas.find((e) => norm(e.nome) === alvo) ??
    empresas.find((e) => norm(e.nome).includes(alvo)) ??
    null
  );
}

/** Aplica `.eq("emitente_id", id)` quando há empresa selecionada. */
export function aplicarEscopoEmitente<T extends { eq: (c: string, v: string) => T }>(
  query: T,
  escopo: Pick<EscopoEmpresa, "emitenteId">,
  coluna = "emitente_id",
): T {
  return escopo.emitenteId ? query.eq(coluna, escopo.emitenteId) : query;
}

/** Rótulo para cabeçalhos e exportações. */
export function rotuloEscopo(escopo: Pick<EscopoEmpresa, "emitente">): string {
  return escopo.emitente?.nome ?? "Todas as empresas";
}
