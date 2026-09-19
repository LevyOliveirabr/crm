"use server";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

export type ResultadoBusca = {
  empresas: { id: string; nome: string; cidade: string | null; uf: string | null }[];
  contatos: { id: string; nome: string; cargo: string | null; empresaId: string; empresaNome: string }[];
  negociacoes: {
    id: string;
    titulo: string;
    empresaNome: string;
    status: string;
    valor: number;
    etapaNome: string;
  }[];
};

const VAZIO: ResultadoBusca = { empresas: [], contatos: [], negociacoes: [] };

/** Busca global (Ctrl+K): empresas, contatos e negociações, 6 de cada. */
export async function buscarGlobal(termo: string): Promise<ResultadoBusca> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return VAZIO;

  const q = termo.trim().replace(/[%_]/g, "").slice(0, 80);
  if (q.length < 2) return VAZIO;
  const like = `%${q}%`;

  const supabase = await createClient();
  const [{ data: empresas }, { data: contatos }, { data: negociacoes }] =
    await Promise.all([
      supabase
        .from("empresas")
        .select("id, nome, cidade, uf")
        .is("arquivado_em", null)
        .ilike("nome", like)
        .order("nome")
        .limit(6),
      supabase
        .from("contatos")
        .select("id, nome, cargo, empresa_id, empresas ( nome )")
        .is("arquivado_em", null)
        .ilike("nome", like)
        .order("nome")
        .limit(6),
      supabase
        .from("v_negociacoes")
        .select("id, titulo, empresa_nome, status, valor_estimado, etapa_nome")
        .or(`titulo.ilike.${like},empresa_nome.ilike.${like}`)
        .order("status", { ascending: true })
        .order("valor_estimado", { ascending: false })
        .limit(6),
    ]);

  type ContatoJoin = {
    id: string;
    nome: string;
    cargo: string | null;
    empresa_id: string;
    empresas: { nome: string } | { nome: string }[] | null;
  };

  return {
    empresas: (empresas ?? []).map((e) => ({
      id: e.id,
      nome: e.nome,
      cidade: e.cidade,
      uf: e.uf,
    })),
    contatos: ((contatos ?? []) as unknown as ContatoJoin[]).map((c) => {
      const emp = Array.isArray(c.empresas) ? c.empresas[0] : c.empresas;
      return {
        id: c.id,
        nome: c.nome,
        cargo: c.cargo,
        empresaId: c.empresa_id,
        empresaNome: emp?.nome ?? "—",
      };
    }),
    negociacoes: (negociacoes ?? [])
      .filter((n) => n.id)
      .map((n) => ({
        id: n.id!,
        titulo: n.titulo ?? "Negociação",
        empresaNome: n.empresa_nome ?? "—",
        status: n.status ?? "aberta",
        valor: Number(n.valor_estimado ?? 0),
        etapaNome: n.etapa_nome ?? "",
      })),
  };
}
