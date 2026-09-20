"use server";

import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

export type DadosFormNegociacao = {
  /** Empresas vendedoras em que o usuário participa. */
  emitentes: { id: string; nome: string }[];
  /** Empresa vendedora do escopo atual (pré-seleção). */
  emitenteInicial: string | null;
  funis: { id: string; nome: string; ordem: number }[];
  linhas: string[];
  origens: string[];
  segmentos: string[];
};

export async function carregarDadosFormNegociacao(): Promise<
  | { ok: true; dados: DadosFormNegociacao }
  | { ok: false; error: string }
> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const supabase = await createClient();
  const escopo = await getEscopoEmpresa(usuario);

  const [{ data: funis }, { data: listas }] = await Promise.all([
    supabase
      .from("funis")
      .select("id, nome, ordem")
      .eq("ativo", true)
      .order("ordem"),
    supabase
      .from("listas")
      .select("tipo, valor, ordem")
      .eq("ativo", true)
      .in("tipo", ["linha", "origem", "segmento"])
      .order("ordem"),
  ]);

  const linhas: string[] = [];
  const origens: string[] = [];
  const segmentos: string[] = [];
  for (const item of listas ?? []) {
    if (item.tipo === "linha") linhas.push(item.valor);
    else if (item.tipo === "origem") origens.push(item.valor);
    else if (item.tipo === "segmento") segmentos.push(item.valor);
  }

  return {
    ok: true,
    dados: {
      emitentes: usuario.empresas.map((e) => ({ id: e.id, nome: e.nome })),
      emitenteInicial: escopo.emitenteId ?? (usuario.empresas.length === 1 ? usuario.empresas[0]!.id : null),
      funis: funis ?? [],
      linhas,
      origens,
      segmentos,
    },
  };
}
