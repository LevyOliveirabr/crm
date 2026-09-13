"use client";

import { useTransition } from "react";

import { alternarUsuarioAtivoAction } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";

export function UsuarioAtivoToggle({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={ativo ? "outline" : "secondary"}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await alternarUsuarioAtivoAction(id, !ativo);
        });
      }}
    >
      {pending ? "…" : ativo ? "Desativar" : "Ativar"}
    </Button>
  );
}
