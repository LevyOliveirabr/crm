"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { campoClass } from "@/components/crm/pagina";
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor="filtro-mes" className="eyebrow">
        Mês
      </label>
      <input
        id="filtro-mes"
        type="month"
        value={mesValor}
        onChange={(e) => onChange(e.target.value)}
        className={campoClass}
      />
    </div>
  );
}
