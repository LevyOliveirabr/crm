"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function EmpresasFiltroBusca({
  valorInicial = "",
}: {
  valorInicial?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(valorInicial);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome"
        aria-label="Buscar empresas"
      />
      <Button type="submit" variant="secondary" size="sm">
        Buscar
      </Button>
    </form>
  );
}
