"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { inicioMesAtualISO } from "@/lib/format";

export function FiltroMes({ valor }: { valor: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mesValor = valor.slice(0, 7) || inicioMesAtualISO().slice(0, 7);

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const atual = inicioMesAtualISO().slice(0, 7);
    if (!next || next === atual) {
      params.delete("mes");
    } else {
      params.set("mes", next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="filtro-mes" className="text-sm font-medium">
        Mês
      </label>
      <input
        id="filtro-mes"
        type="month"
        value={mesValor}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full max-w-xs rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  );
}
