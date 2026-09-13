"use server";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

export type DadosFormNegociacao = {
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
      funis: funis ?? [],
      linhas,
      origens,
      segmentos,
    },
  };
}
