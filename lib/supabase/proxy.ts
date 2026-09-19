import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";

const ROTAS_PUBLICAS = new Set(["/login", "/auth/definir-senha", "/auth/callback"]);

function ehRotaApp(pathname: string) {
  if (ROTAS_PUBLICAS.has(pathname)) return false;
  if (pathname.startsWith("/login")) return false;
  if (pathname.startsWith("/auth/")) return false;
  // MCP autentica via Bearer API key (não cookie de sessão)
  if (pathname.startsWith("/api/mcp")) return false;
  // cron da Vercel autentica por CRON_SECRET
  if (pathname.startsWith("/api/cron")) return false;
  // aceite de orçamento pelo cliente (link assinado, sem login)
  if (pathname.startsWith("/aceite/")) return false;
  if (pathname === "/") return false;
  return true;
}

export async function atualizarSessao(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const code = request.nextUrl.searchParams.get("code");

  // Links de convite/recovery do Supabase às vezes chegam como /?code=...
  if (pathname === "/" && code) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.searchParams.set("code", code);
    if (!url.searchParams.get("next")) {
      url.searchParams.set("next", "/auth/definir-senha");
    }
    return NextResponse.redirect(url);
  }

  if (!user && ehRotaApp(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && ehRotaApp(pathname)) {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("ativo")
      .eq("id", user.id)
      .maybeSingle();

    if (usuario && !usuario.ativo) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("erro", "inativo");
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
