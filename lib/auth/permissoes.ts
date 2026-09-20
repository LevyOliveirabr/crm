import type { PerfilUsuario, UsuarioAtual } from "@/lib/auth/get-usuario-atual";

type ComEmpresas = Pick<UsuarioAtual, "empresas" | "ehDiretorEmAlguma">;

/** Perfil do usuário numa empresa vendedora, ou null se não participa dela. */
export function perfilEm(
  usuario: ComEmpresas,
  emitenteId: string | null | undefined,
): PerfilUsuario | null {
  if (!emitenteId) return null;
  return usuario.empresas.find((e) => e.id === emitenteId)?.perfil ?? null;
}

export function ehDiretorDe(usuario: ComEmpresas, emitenteId: string | null | undefined): boolean {
  return perfilEm(usuario, emitenteId) === "diretor";
}

export function ehMembroDe(usuario: ComEmpresas, emitenteId: string | null | undefined): boolean {
  return perfilEm(usuario, emitenteId) != null;
}

/** Diretor ou gerente na empresa (ou em alguma, quando não informada). */
export function podeVerEquipeEm(
  usuario: ComEmpresas,
  emitenteId: string | null | undefined,
): boolean {
  if (emitenteId) {
    const p = perfilEm(usuario, emitenteId);
    return p === "diretor" || p === "gerente";
  }
  return usuario.empresas.some((e) => e.perfil === "diretor" || e.perfil === "gerente");
}

/** Ids das empresas em que o usuário é diretor. */
export function empresasOndeEhDiretor(usuario: ComEmpresas): string[] {
  return usuario.empresas.filter((e) => e.perfil === "diretor").map((e) => e.id);
}
