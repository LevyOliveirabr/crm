import { getUsuarioAtual, type UsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { ehDiretorDe } from "@/lib/auth/permissoes";

/** Usuário ativo e diretor em alguma empresa (recursos globais). */
export async function exigirDiretorEmAlguma(): Promise<UsuarioAtual | null> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ativo || !usuario.ehDiretorEmAlguma) return null;
  return usuario;
}

/** Usuário ativo e diretor da empresa vendedora informada. */
export async function exigirDiretorDe(
  emitenteId: string | null | undefined,
): Promise<UsuarioAtual | null> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ativo || !ehDiretorDe(usuario, emitenteId)) return null;
  return usuario;
}
