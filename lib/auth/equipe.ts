import type { SupabaseClient } from "@supabase/supabase-js";

import type { UsuarioAtual } from "@/lib/auth/get-usuario-atual";
import type { EscopoEmpresa } from "@/lib/auth/escopo-empresa-core";
import { podeVerEquipeEm } from "@/lib/auth/permissoes";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;
type Escopo = Pick<EscopoEmpresa, "emitenteId">;

export type VendedorOption = { id: string; nome: string };

/** Diretor ou gerente (na empresa do escopo, ou em alguma) pode filtrar por vendedor. */
export function podeVerEquipe(
  usuario: Pick<UsuarioAtual, "empresas" | "ehDiretorEmAlguma">,
  escopo?: Escopo | null,
): boolean {
  return podeVerEquipeEm(usuario, escopo?.emitenteId ?? null);
}

function empresasConsideradas(
  usuario: Pick<UsuarioAtual, "empresas">,
  escopo?: Escopo | null,
) {
  if (escopo?.emitenteId) {
    return usuario.empresas.filter((e) => e.id === escopo.emitenteId);
  }
  return usuario.empresas;
}

/**
 * Vendedores que aparecem no seletor: nas empresas em que é diretor, todos os
 * membros ativos; nas em que é gerente, a equipe dele mais ele mesmo; como
 * vendedor, ninguém. Com escopo "Todas", é a união das empresas.
 */
export async function listarVendedoresVisiveis(
  supabase: Client,
  usuario: Pick<UsuarioAtual, "id" | "nome" | "empresas">,
  escopo?: Escopo | null,
): Promise<VendedorOption[]> {
  const empresas = empresasConsideradas(usuario, escopo);
  const comoDiretor = empresas.filter((e) => e.perfil === "diretor").map((e) => e.id);
  const comoGerente = empresas.filter((e) => e.perfil === "gerente").map((e) => e.id);
  if (comoDiretor.length === 0 && comoGerente.length === 0) return [];

  type Linha = {
    usuario_id: string;
    emitente_id: string;
    gerente_id: string | null;
    usuarios: { nome: string; ativo: boolean } | { nome: string; ativo: boolean }[] | null;
  };
  const { data, error } = await supabase
    .from("usuario_emitentes")
    .select("usuario_id, emitente_id, gerente_id, usuarios:usuario_id ( nome, ativo )")
    .in("emitente_id", [...comoDiretor, ...comoGerente]);
  if (error) return [{ id: usuario.id, nome: usuario.nome }];

  const vistos = new Map<string, string>();
  for (const l of (data ?? []) as unknown as Linha[]) {
    const u = Array.isArray(l.usuarios) ? l.usuarios[0] : l.usuarios;
    if (!u?.ativo) continue;
    const ehDiretorAqui = comoDiretor.includes(l.emitente_id);
    const ehEquipe = comoGerente.includes(l.emitente_id) && l.gerente_id === usuario.id;
    if (ehDiretorAqui || ehEquipe) vistos.set(l.usuario_id, u.nome);
  }
  if (comoGerente.length > 0) vistos.set(usuario.id, usuario.nome);

  return [...vistos.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Resolve o filtro ?vendedor= respeitando o que o usuário pode ver. */
export function resolverFiltroVendedor(
  usuario: Pick<UsuarioAtual, "empresas" | "ehDiretorEmAlguma">,
  vendedores: VendedorOption[],
  param: string | undefined,
  escopo?: Escopo | null,
): string | null {
  if (!param || !podeVerEquipe(usuario, escopo)) return null;
  return vendedores.some((v) => v.id === param) ? param : null;
}

/**
 * Ids de responsáveis a que as consultas devem se limitar: null quando o
 * usuário é diretor em todas as empresas consideradas (sem limite); senão os
 * vendedores visíveis (gerente: equipe; vendedor: ele mesmo).
 */
export function idsEquipeVisivel(
  usuario: Pick<UsuarioAtual, "id" | "empresas">,
  vendedores: VendedorOption[],
  escopo?: Escopo | null,
): string[] | null {
  const empresas = empresasConsideradas(usuario, escopo);
  if (empresas.length > 0 && empresas.every((e) => e.perfil === "diretor")) return null;
  const ids = new Set(vendedores.map((v) => v.id));
  ids.add(usuario.id);
  return [...ids];
}
