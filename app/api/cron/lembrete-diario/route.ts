import { NextResponse } from "next/server";

import { executarLembreteDiario } from "@/lib/lembrete-diario";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lembrete diário de ações (cron da Vercel, ver vercel.json).
 *
 * Autenticação: a Vercel envia `Authorization: Bearer <CRON_SECRET>` quando a
 * variável CRON_SECRET está definida no projeto. Sem CRON_SECRET configurado,
 * a rota recusa qualquer chamada (evita disparo público de e-mails).
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  if (!segredo || auth !== `Bearer ${segredo}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const inicio = Date.now();
  try {
    const supabase = createAdminClient();
    const resultado = await executarLembreteDiario(supabase);
    return NextResponse.json({
      ok: resultado.erros.length === 0,
      ...resultado,
      ms: Date.now() - inicio,
    });
  } catch (err) {
    console.error("[cron lembrete-diario]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Falha." },
      { status: 500 },
    );
  }
}
