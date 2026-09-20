"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { definirVinculoAction, type VinculoUsuario } from "@/lib/actions/usuarios";

type Perfil = "diretor" | "gerente" | "vendedor";

const PERFIS: { valor: Perfil | ""; label: string }[] = [
  { valor: "", label: "Sem acesso" },
  { valor: "vendedor", label: "Vendedor" },
  { valor: "gerente", label: "Gerente" },
  { valor: "diretor", label: "Diretor" },
];

/**
 * Grade "empresa × perfil × gerente" de um usuário. Só aparecem as empresas
 * em que quem está logado é diretor.
 */
export function UsuarioEmpresasEditor({
  usuarioId,
  vinculos,
  empresas,
  gerentesPorEmpresa,
  ehEuMesmo,
}: {
  usuarioId: string;
  vinculos: VinculoUsuario[];
  empresas: { id: string; nome: string }[];
  /** Gerentes ativos de cada empresa (para o select do vendedor). */
  gerentesPorEmpresa: Record<string, { id: string; nome: string }[]>;
  ehEuMesmo: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<Record<string, { perfil: Perfil | ""; gerenteId: string }>>(() => {
    const out: Record<string, { perfil: Perfil | ""; gerenteId: string }> = {};
    for (const e of empresas) {
      const v = vinculos.find((x) => x.emitenteId === e.id);
      out[e.id] = { perfil: v?.perfil ?? "", gerenteId: v?.gerenteId ?? "" };
    }
    return out;
  });

  function salvar(emitenteId: string, perfil: Perfil | "", gerenteId: string) {
    setErro(null);
    setEstado((s) => ({ ...s, [emitenteId]: { perfil, gerenteId } }));
    startTransition(async () => {
      const res = await definirVinculoAction({
        usuarioId,
        emitenteId,
        perfil: perfil || null,
        gerenteId: perfil === "vendedor" ? gerenteId || null : null,
      });
      if (res.error) {
        setErro(res.error);
        const v = vinculos.find((x) => x.emitenteId === emitenteId);
        setEstado((s) => ({ ...s, [emitenteId]: { perfil: v?.perfil ?? "", gerenteId: v?.gerenteId ?? "" } }));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {empresas.map((e) => {
        const atual = estado[e.id] ?? { perfil: "" as const, gerenteId: "" };
        const gerentes = (gerentesPorEmpresa[e.id] ?? []).filter((g) => g.id !== usuarioId);
        return (
          <div key={e.id} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="w-28 truncate font-medium" title={e.nome}>
              {e.nome}
            </span>
            <select
              aria-label={`Perfil em ${e.nome}`}
              value={atual.perfil}
              disabled={pending || (ehEuMesmo && atual.perfil === "diretor")}
              onChange={(ev) => salvar(e.id, ev.target.value as Perfil | "", atual.gerenteId)}
              className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
            >
              {PERFIS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.label}
                </option>
              ))}
            </select>
            {atual.perfil === "vendedor" ? (
              <select
                aria-label={`Gerente em ${e.nome}`}
                value={atual.gerenteId}
                disabled={pending}
                onChange={(ev) => salvar(e.id, "vendedor", ev.target.value)}
                className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
              >
                <option value="">sem gerente</option>
                {gerentes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        );
      })}
      {erro ? <span className="text-xs text-destructive">{erro}</span> : null}
    </div>
  );
}
