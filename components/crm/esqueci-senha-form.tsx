"use client";

import Link from "next/link";
import { useActionState } from "react";

import { esqueciSenhaAction, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AuthActionState = {};

export function EsqueciSenhaForm() {
  const [state, formAction, pending] = useActionState(
    esqueciSenhaAction,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground" role="status">
          Se existir uma conta com esse e-mail, enviamos um link para redefinir
          a senha. Confira a caixa de entrada e o spam.
        </p>
        <Link
          href="/login"
          className="text-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Voltar ao login
        </Link>
      </div>
    );
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
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link de redefinição"}
      </Button>
      <Link
        href="/login"
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Voltar ao login
      </Link>
    </form>
  );
}
