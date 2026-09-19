/**
 * Teste de RLS contra um projeto Supabase real (staging ou local).
 *
 * Roda só quando as variáveis abaixo existem; caso contrário é pulado.
 *   TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY
 *   TEST_VENDEDOR_A_EMAIL / TEST_VENDEDOR_A_SENHA
 *   TEST_VENDEDOR_B_EMAIL / TEST_VENDEDOR_B_SENHA
 *
 * Garante o critério de aceite 3 da SPEC: um vendedor nunca vê negociação
 * de outro, nem pela API REST.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const anon = process.env.TEST_SUPABASE_ANON_KEY;
const a = { email: process.env.TEST_VENDEDOR_A_EMAIL, senha: process.env.TEST_VENDEDOR_A_SENHA };
const b = { email: process.env.TEST_VENDEDOR_B_EMAIL, senha: process.env.TEST_VENDEDOR_B_SENHA };
const habilitado = Boolean(url && anon && a.email && a.senha && b.email && b.senha);

async function logar(email: string, senha: string) {
  const client = createClient(url!, anon!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) throw new Error(`Login falhou para ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!habilitado)("RLS: isolamento entre vendedores", () => {
  it("vendedor A não enxerga negociações do vendedor B", async () => {
    const A = await logar(a.email!, a.senha!);
    const B = await logar(b.email!, b.senha!);

    const { data: deB } = await B.client
      .from("negociacoes")
      .select("id, responsavel_id")
      .eq("responsavel_id", B.userId);

    const { data: vistasPorA } = await A.client.from("negociacoes").select("id, responsavel_id");
    const idsDeB = new Set((deB ?? []).map((n) => n.id));

    for (const n of vistasPorA ?? []) {
      expect(idsDeB.has(n.id)).toBe(false);
      expect(n.responsavel_id).toBe(A.userId);
    }
  });

  it("vendedor A não consegue editar negociação de B nem por id", async () => {
    const A = await logar(a.email!, a.senha!);
    const B = await logar(b.email!, b.senha!);
    const { data: deB } = await B.client
      .from("negociacoes")
      .select("id, titulo")
      .eq("responsavel_id", B.userId)
      .limit(1);
    if (!deB || deB.length === 0) return;

    const alvo = deB[0]!;
    const { data: atualizadas } = await A.client
      .from("negociacoes")
      .update({ titulo: `${alvo.titulo} (hack)` })
      .eq("id", alvo.id)
      .select("id");
    expect(atualizadas ?? []).toHaveLength(0);
  });
});
