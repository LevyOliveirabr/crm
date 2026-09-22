"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Flame } from "lucide-react";

import { formatarData, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartaoNegociacaoData } from "@/components/crm/cartao-negociacao";
import { EstadoVazio, campoClass } from "@/components/crm/pagina";
import { Badge } from "@/components/ui/badge";

type SortKey =
  | "titulo"
  | "empresaNome"
  | "etapaNome"
  | "valorEstimado"
  | "temperatura"
  | "diasNaEtapa"
  | "proximaAcaoData"
  | "responsavelNome";

export type LinhaLista = CartaoNegociacaoData & {
  etapaNome: string;
};

function Temperatura({ valor }: { valor: number }) {
  const temp = Math.min(3, Math.max(1, valor || 1));
  return (
    <span className="inline-flex items-center gap-0.5 text-brand-foreground">
      {Array.from({ length: temp }, (_, i) => (
        <Flame key={i} className="size-3 fill-current" aria-hidden />
      ))}
    </span>
  );
}

const ORDENACAO: { id: SortKey; label: string }[] = [
  { id: "valorEstimado", label: "Valor" },
  { id: "titulo", label: "Título" },
  { id: "empresaNome", label: "Empresa" },
  { id: "etapaNome", label: "Etapa" },
  { id: "temperatura", label: "Temperatura" },
  { id: "diasNaEtapa", label: "Dias na etapa" },
  { id: "proximaAcaoData", label: "Próxima ação" },
  { id: "responsavelNome", label: "Responsável" },
];

export function FunilLista({ linhas }: { linhas: LinhaLista[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("valorEstimado");
  const [sortAsc, setSortAsc] = useState(false);

  const ordenadas = useMemo(() => {
    const copy = [...linhas];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = 1;
      else if (bv == null) cmp = -1;
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "pt-BR");
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [linhas, sortKey, sortAsc]);

  if (linhas.length === 0) {
    return (
      <EstadoVazio texto="Nenhuma negociação neste funil com os filtros atuais." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-muted-foreground sm:max-w-xs">
          Ordenar por
          <select
            className={campoClass}
            value={sortKey}
            onChange={(e) => {
              const key = e.target.value as SortKey;
              setSortKey(key);
              setSortAsc(
                key === "titulo" || key === "empresaNome" || key === "etapaNome",
              );
            }}
          >
            {ORDENACAO.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setSortAsc((v) => !v)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-input px-3 text-sm font-medium"
        >
          {sortAsc ? (
            <ArrowUp className="size-3.5" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden />
          )}
          {sortAsc ? "Crescente" : "Decrescente"}
        </button>
      </div>
      <ul className="divide-y divide-border">
        {ordenadas.map((n) => (
          <li key={n.id} className="flex flex-col gap-1 py-3">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/negociacoes/${n.id}`}
                className="font-medium hover:underline"
              >
                {n.titulo}
              </Link>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatarMoeda(n.valorEstimado)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {n.empresaNome} · {n.etapaNome}
            </p>
            <p
              className={cn(
                "text-sm",
                n.acaoAtrasada && "text-destructive",
              )}
            >
              {n.proximaAcaoDescricao ?? "Sem próxima ação"}
              {n.proximaAcaoData ? ` · ${formatarData(n.proximaAcaoData)}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{n.responsavelNome ?? "—"}</span>
              <Temperatura valor={n.temperatura} />
              <span>{n.diasNaEtapa} dias na etapa</span>
              {n.acaoAtrasada ? (
                <Badge variant="destructive">Atrasada</Badge>
              ) : null}
              {n.semAcao ? <Badge variant="warning">Sem ação</Badge> : null}
              {n.parada ? <Badge variant="secondary">Parada</Badge> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
