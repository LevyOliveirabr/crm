"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { campoClass } from "@/components/crm/pagina";

export type VendedorOption = {
  id: string;
  nome: string;
};

export function SeletorVendedor({
  vendedores,
  valor,
}: {
  vendedores: VendedorOption[];
  valor: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!next || next === "todos") {
      params.delete("vendedor");
    } else {
      params.set("vendedor", next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor="filtro-vendedor" className="eyebrow">
        Vendedor
      </label>
      <select
        id="filtro-vendedor"
        value={valor ?? "todos"}
        onChange={(e) => onChange(e.target.value)}
        className={campoClass}
      >
        <option value="todos">Todos</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
