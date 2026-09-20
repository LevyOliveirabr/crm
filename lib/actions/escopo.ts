"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { COOKIE_EMITENTE, VALOR_TODAS } from "@/lib/auth/escopo-empresa-core";

/** Grava a empresa vendedora ativa (ou "todas") no cookie do usuário. */
export async function definirEmpresaAtiva(
  valor: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const alvo = (valor ?? "").trim() || VALOR_TODAS;
  if (alvo !== VALOR_TODAS && !usuario.empresas.some((e) => e.id === alvo)) {
    return { ok: false, error: "Empresa não disponível para este usuário." };
  }

  const jar = await cookies();
  jar.set(COOKIE_EMITENTE, alvo, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
