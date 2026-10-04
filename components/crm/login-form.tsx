"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { loginAction, type AuthActionState } from "@/lib/actions/auth";
import { nextSeguro } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const initialState: AuthActionState = {};

function IconeGoogle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

export function LoginForm({
  erroInicial,
  next,
}: {
  erroInicial?: string;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [pendingGoogle, setPendingGoogle] = useState(false);
  const [erroGoogle, setErroGoogle] = useState<string | undefined>();
  const erro = erroGoogle ?? state.error ?? erroInicial;
  const ocupado = pending || pendingGoogle;

  async function entrarComGoogle() {
    setErroGoogle(undefined);
    setPendingGoogle(true);
    const destino = nextSeguro(next);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "online", prompt: "select_account" },
      },
    });
    if (error) {
      setErroGoogle(
        "Não foi possível iniciar o login com Google. Tente de novo ou entre com e-mail e senha.",
      );
      setPendingGoogle(false);
    }
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          E-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@empresa.com"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Senha
          </label>
          <Link
            href="/login/esqueci-senha"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>
      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={ocupado}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">ou</span>
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={ocupado}
        onClick={entrarComGoogle}
      >
        <IconeGoogle className="size-4" />
        {pendingGoogle ? "Redirecionando…" : "Entrar com Google"}
      </Button>
    </form>
  );
}
