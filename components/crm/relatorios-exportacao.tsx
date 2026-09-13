"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { BotaoExportar } from "@/components/crm/botao-exportar";
import { cn } from "@/lib/utils";

const ABAS: {
  id: string;
  label: string;
  tela: string;
  diretorOnly?: boolean;
}[] = [
  {
    id: "presidencia",
    label: "Presidência",
    tela: "relatorio-presidencia-top",
  },
  { id: "previsao", label: "Previsão", tela: "previsao" },
  { id: "ranking", label: "Ranking", tela: "ranking", diretorOnly: true },
  { id: "perdas", label: "Perdas", tela: "perdas" },
  { id: "carteira", label: "Carteira parada", tela: "carteira-parada" },
];

export function RelatoriosExportacao({
  aba,
  mes,
  vendedor,
  linha,
  origem,
  isDiretor,
}: {
  aba: string;
  mes: string;
  vendedor: string | null;
  linha: string | null;
  origem: string | null;
  isDiretor: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const abas = ABAS.filter((a) => !a.diretorOnly || isDiretor);
  const atual = abas.find((a) => a.id === aba) ?? abas[0]!;

  function hrefAba(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("aba", id);
    return `${pathname}?${params.toString()}`;
  }

  const filtros = {
    mes,
    vendedor,
    linha,
    origem,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap gap-1" aria-label="Abas de relatórios">
          {abas.map((a) => (
            <Link
              key={a.id}
              href={hrefAba(a.id)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-sm font-medium",
                a.id === atual.id
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {a.label}
            </Link>
          ))}
        </nav>
        <BotaoExportar tela={atual.tela} filtros={filtros} />
      </div>
      <p className="text-sm text-muted-foreground">
        Aba ativa: <span className="font-medium text-foreground">{atual.label}</span>
        . Exporta com os filtros de mês/vendedor/linha/origem da URL.
      </p>
    </div>
  );
}
