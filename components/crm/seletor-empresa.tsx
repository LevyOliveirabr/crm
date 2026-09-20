"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import { definirEmpresaAtiva } from "@/lib/actions/escopo";
import type { EmpresaDoUsuario } from "@/lib/auth/get-usuario-atual";
import { cn } from "@/lib/utils";

/**
 * Seletor global de empresa vendedora ("Todas" ou uma empresa). Persiste no
 * cookie e recarrega as telas. Fica oculto quando o usuário só tem uma empresa.
 */
export function SeletorEmpresa({
  empresas,
  valor,
  fixo,
  compacto = false,
  tema = "sidebar",
}: {
  empresas: EmpresaDoUsuario[];
  valor: string | null;
  fixo: boolean;
  compacto?: boolean;
  tema?: "sidebar" | "claro";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (empresas.length === 0) return null;

  if (fixo) {
    const unica = empresas[0]!;
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
          tema === "sidebar" ? "text-sidebar-foreground/80" : "text-muted-foreground",
        )}
        title="Empresa vendedora"
      >
        <Building2 className="size-3.5 shrink-0" />
        <span className="truncate">{unica.nome}</span>
      </div>
    );
  }

  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1 text-xs",
        tema === "sidebar" ? "text-sidebar-foreground/80" : "text-muted-foreground",
      )}
    >
      <Building2 className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">Empresa vendedora</span>
      <select
        aria-label="Empresa vendedora"
        value={valor ?? "todas"}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          startTransition(async () => {
            await definirEmpresaAtiva(v === "todas" ? null : v);
            router.refresh();
          });
        }}
        className={cn(
          "h-8 min-w-0 flex-1 rounded-lg border px-2 text-sm outline-none",
          tema === "sidebar"
            ? "border-white/15 bg-white/5 text-sidebar-foreground focus-visible:border-white/40 [&>option]:text-foreground"
            : "border-input bg-transparent text-foreground focus-visible:border-ring",
          compacto && "max-w-[10rem]",
        )}
      >
        <option value="todas">Todas as empresas</option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
