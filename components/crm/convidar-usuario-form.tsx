"use client";

import { useActionState } from "react";

import {
  convidarUsuarioAction,
  type UsuarioActionState,
} from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: UsuarioActionState = {};

export function ConvidarUsuarioForm({
  empresas,
  empresaInicial,
}: {
  /** Empresas em que o diretor logado pode convidar. */
  empresas: { id: string; nome: string }[];
  empresaInicial: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    convidarUsuarioAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nome" className="text-sm font-medium">
            Nome
          </label>
          <Input id="nome" name="nome" required placeholder="Nome completo" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="email@empresa.com"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="emitente_id" className="text-sm font-medium">
            Empresa vendedora
          </label>
          <select
            id="emitente_id"
            name="emitente_id"
            required
            defaultValue={empresaInicial ?? empresas[0]?.id ?? ""}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="perfil" className="text-sm font-medium">
            Perfil nessa empresa
          </label>
          <select
            id="perfil"
            name="perfil"
            defaultValue="vendedor"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="vendedor">Vendedor</option>
            <option value="gerente">Gerente (vê a equipe)</option>
            <option value="diretor">Diretor</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Outras empresas e perfis podem ser definidos na lista abaixo depois do convite.
      </p>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="text-sm text-foreground" role="status">
          {state.message}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending || empresas.length === 0}>
          {pending ? "Enviando…" : "Convidar"}
        </Button>
      </div>
    </form>
  );
}
