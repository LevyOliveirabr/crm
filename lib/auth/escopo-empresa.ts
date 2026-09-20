import { cookies } from "next/headers";

import type { UsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  COOKIE_EMITENTE,
  resolverEscopo,
  type EscopoEmpresa,
} from "@/lib/auth/escopo-empresa-core";

export {
  aplicarEscopoEmitente,
  encontrarEmpresa,
  rotuloEscopo,
  resolverEscopo,
  COOKIE_EMITENTE,
  VALOR_TODAS,
  type EscopoEmpresa,
} from "@/lib/auth/escopo-empresa-core";

/**
 * Escopo de empresa vendedora da requisição atual: `?emitente=` (se houver)
 * e, senão, o cookie `crm_emitente`. Sempre validado contra as empresas do
 * usuário.
 */
export async function getEscopoEmpresa(
  usuario: Pick<UsuarioAtual, "empresas">,
  searchParams?: { emitente?: string | string[] } | null,
): Promise<EscopoEmpresa> {
  const jar = await cookies();
  return resolverEscopo(usuario.empresas, {
    param: searchParams?.emitente ?? null,
    cookie: jar.get(COOKIE_EMITENTE)?.value ?? null,
  });
}
