import type { SupabaseClient } from "@supabase/supabase-js";

import type { UsuarioAtual } from "@/lib/auth/get-usuario-atual";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type VendedorOption = { id: string; nome: string };

/** Diretor e gerente podem filtrar por vendedor e ver a equipe. */
export function podeVerEquipe(usuario: Pick<UsuarioAtual, "perfil">): boolean {
  return usuario.perfil === "diretor" || usuario.perfil === "gerente";
}

/**
 * Vendedores que aparecem no seletor: todos os ativos para o diretor, a
 * equipe (mais ele mesmo) para o gerente, nenhum para o vendedor.
 * Se a coluna gerente_id ainda não existir (migration 0007), o gerente vê só
 * a si mesmo.
 */
export async function listarVendedoresVisiveis(
  supabase: Client,
  usuario: Pick<UsuarioAtual, "id" | "nome" | "perfil">,
): Promise<VendedorOption[]> {
  if (usuario.perfil === "diretor") {
    const { data } = await supabase
      .from("usuarios")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    return data ?? [];
  }
  if (usuario.perfil === "gerente") {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome")
      .eq("ativo", true)
      .eq("gerente_id", usuario.id)
      .order("nome");
    const equipe = error ? [] : (data ?? []);
    const comEle = [{ id: usuario.id, nome: usuario.nome }, ...equipe.filter((u) => u.id !== usuario.id)];
    return comEle.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  return [];
}

/** Resolve o filtro ?vendedor= respeitando o que o usuário pode ver. */
export function resolverFiltroVendedor(
  usuario: Pick<UsuarioAtual, "perfil">,
  vendedores: VendedorOption[],
  param: string | undefined,
): string | null {
  if (!param || !podeVerEquipe(usuario)) return null;
  if (usuario.perfil === "diretor") return param;
  return vendedores.some((v) => v.id === param) ? param : null;
}
