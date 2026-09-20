import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type PerfilUsuario = Database["public"]["Enums"]["perfil_usuario"];

/** Vínculo do usuário com uma empresa vendedora (emitente) e o perfil nela. */
export type EmpresaDoUsuario = {
  id: string;
  nome: string;
  perfil: PerfilUsuario;
  gerenteId: string | null;
  ativo: boolean;
};

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

/**
 * Usuário autenticado com os vínculos por empresa vendedora.
 *
 * `perfil` e `gerente_id` de `usuarios` NÃO são expostos de propósito: o perfil
 * é por empresa (`empresas[].perfil`). Use `ehDiretorEmAlguma` para recursos
 * globais e `perfilEm(usuario, emitenteId)` (lib/auth/permissoes) para recursos
 * de uma empresa. `perfilMaximo` serve só para exibição.
 */
export type UsuarioAtual = Omit<UsuarioRow, "perfil" | "gerente_id"> & {
  empresas: EmpresaDoUsuario[];
  ehDiretorEmAlguma: boolean;
  perfilMaximo: PerfilUsuario;
};

const ORDEM_PERFIL: Record<PerfilUsuario, number> = {
  vendedor: 0,
  gerente: 1,
  diretor: 2,
};

export function perfilMaisAlto(perfis: PerfilUsuario[]): PerfilUsuario {
  let max: PerfilUsuario = "vendedor";
  for (const p of perfis) {
    if (ORDEM_PERFIL[p] > ORDEM_PERFIL[max]) max = p;
  }
  return max;
}

/** Monta o UsuarioAtual a partir da linha de `usuarios` e dos vínculos. */
export function montarUsuarioAtual(
  row: UsuarioRow,
  empresas: EmpresaDoUsuario[],
): UsuarioAtual {
  const { perfil: _perfil, gerente_id: _gerente, ...resto } = row;
  void _perfil;
  void _gerente;
  const ordenadas = [...empresas].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return {
    ...resto,
    empresas: ordenadas,
    ehDiretorEmAlguma: ordenadas.some((e) => e.perfil === "diretor"),
    perfilMaximo: perfilMaisAlto(ordenadas.map((e) => e.perfil)),
  };
}

type VinculoJoin = {
  emitente_id: string;
  perfil: PerfilUsuario;
  gerente_id: string | null;
  emitentes: { nome: string; ativo: boolean } | { nome: string; ativo: boolean }[] | null;
};

/** Retorna o usuário autenticado com as empresas vendedoras em que participa. */
export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data, error }, { data: vinculos }] = await Promise.all([
    supabase.from("usuarios").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("usuario_emitentes")
      .select("emitente_id, perfil, gerente_id, emitentes ( nome, ativo )")
      .eq("usuario_id", user.id),
  ]);

  if (error || !data) return null;

  const empresas: EmpresaDoUsuario[] = ((vinculos ?? []) as unknown as VinculoJoin[])
    .map((v) => {
      const em = Array.isArray(v.emitentes) ? v.emitentes[0] : v.emitentes;
      return {
        id: v.emitente_id,
        nome: em?.nome ?? "—",
        perfil: v.perfil,
        gerenteId: v.gerente_id,
        ativo: em?.ativo ?? true,
      };
    })
    .filter((e) => e.ativo);

  return montarUsuarioAtual(data, empresas);
}
