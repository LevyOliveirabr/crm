import { NextResponse } from "next/server";

import { nextSeguro } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

const DESTINO_CONVITE = "/auth/definir-senha";

/**
 * Troca o `code` por sessão (PKCE). Atende convite/recovery por e-mail
 * (next = /auth/definir-senha) e login OAuth com Google (next = rota do app).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = nextSeguro(searchParams.get("next"), DESTINO_CONVITE);
  // Fluxo de e-mail (convite/recovery) tem mensagem própria; o resto é OAuth.
  const erro = next === DESTINO_CONVITE ? "convite" : "google";

  // Supabase devolve `error`/`error_description` em vez de `code` quando o
  // provedor recusa — por exemplo, Google com e-mail não convidado e sign-up
  // público desligado.
  const erroProvedor = searchParams.get("error");
  if (erroProvedor) {
    console.error(
      "[auth/callback]",
      erroProvedor,
      searchParams.get("error_description") ?? "",
    );
    return NextResponse.redirect(`${origin}/login?erro=${erro}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback]", error.message);
  }

  return NextResponse.redirect(`${origin}/login?erro=${erro}`);
}
