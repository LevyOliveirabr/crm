"use client";

import { useActionState } from "react";

import {
  convidarUsuarioAction,
  type UsuarioActionState,
} from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: UsuarioActionState = {};

export function ConvidarUsuarioForm() {
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
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <label htmlFor="perfil" className="text-sm font-medium">
          Perfil
        </label>
        <Select name="perfil" defaultValue="vendedor">
          <SelectTrigger id="perfil" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vendedor">Vendedor</SelectItem>
            <SelectItem value="diretor">Diretor</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Convidar"}
        </Button>
      </div>
    </form>
  );
}
