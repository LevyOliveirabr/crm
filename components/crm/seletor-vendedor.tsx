"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

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
    <div className="flex flex-col gap-1.5">
      <label htmlFor="filtro-vendedor" className="text-sm font-medium">
        Vendedor
      </label>
      <select
        id="filtro-vendedor"
        value={valor ?? "todos"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full max-w-xs rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
