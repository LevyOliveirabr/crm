"use client";

import { useState, useTransition } from "react";

import { definirGerenteAction } from "@/lib/actions/usuarios";

export function UsuarioGerenteSelect({
  usuarioId,
  gerenteId,
  gerentes,
}: {
  usuarioId: string;
  gerenteId: string | null;
  gerentes: { id: string; nome: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState(gerenteId ?? "");
  const [erro, setErro] = useState<string | null>(null);

  if (gerentes.length === 0) {
    return <span className="text-xs text-muted-foreground">sem gerentes</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Gerente responsável"
        value={valor}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          setValor(v);
          setErro(null);
          startTransition(async () => {
            const res = await definirGerenteAction(usuarioId, v || null);
            if (res.error) {
              setErro(res.error);
              setValor(gerenteId ?? "");
            }
          });
        }}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
      >
        <option value="">—</option>
        {gerentes.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nome}
          </option>
        ))}
      </select>
      {erro ? <span className="text-xs text-destructive">{erro}</span> : null}
    </div>
  );
}
