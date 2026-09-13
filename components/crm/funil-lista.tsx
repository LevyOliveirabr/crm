"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Flame } from "lucide-react";

import { formatarData, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartaoNegociacaoData } from "@/components/crm/cartao-negociacao";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <span className="inline-flex items-center gap-0.5 text-orange-600">
      {Array.from({ length: temp }, (_, i) => (
        <Flame key={i} className="size-3 fill-current" aria-hidden />
      ))}
    </span>
  );
}

function SortHead({
  label,
  column,
  className,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  column: SortKey;
  className?: string;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const ativo = sortKey === column;
  const Icon = !ativo ? ArrowUpDown : sortAsc ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      >
        {label}
        <Icon className="size-3.5 opacity-60" aria-hidden />
      </button>
    </TableHead>
  );
}

export function FunilLista({ linhas }: { linhas: LinhaLista[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("valorEstimado");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(
        key === "titulo" || key === "empresaNome" || key === "etapaNome",
      );
    }
  }

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
      <p className="text-sm text-muted-foreground">
        Nenhuma negociação neste funil com os filtros atuais.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHead
            label="Título"
            column="titulo"
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={toggleSort}
          />
          <SortHead
            label="Empresa"
            column="empresaNome"
            className="hidden sm:table-cell"
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={toggleSort}
          />
          <SortHead
            label="Etapa"
            column="etapaNome"
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={toggleSort}
          />
          <SortHead
            label="Valor"
            column="valorEstimado"
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={toggleSort}
          />
          <SortHead
            label="Temp."
            column="temperatura"
            className="hidden md:table-cell"
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={toggleSort}
          />
          <SortHead
            label="Dias"
            column="diasNaEtapa"
            className="hidden md:table-cell"
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={toggleSort}
          />
          <SortHead
            label="Próxima ação"
            column="proximaAcaoData"
            className="hidden lg:table-cell"
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={toggleSort}
          />
          <SortHead
            label="Responsável"
            column="responsavelNome"
            className="hidden lg:table-cell"
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={toggleSort}
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {ordenadas.map((n) => (
          <TableRow key={n.id}>
            <TableCell>
              <Link
                href={`/negociacoes/${n.id}`}
                className="font-medium hover:underline"
              >
                {n.titulo}
              </Link>
              <div className="mt-0.5 flex flex-wrap gap-1 sm:hidden">
                <span className="text-xs text-muted-foreground">
                  {n.empresaNome}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {n.acaoAtrasada ? (
                  <Badge variant="destructive">Atrasada</Badge>
                ) : null}
                {n.semAcao ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-800"
                  >
                    Sem ação
                  </Badge>
                ) : null}
                {n.parada ? (
                  <Badge variant="secondary">Parada</Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">{n.empresaNome}</TableCell>
            <TableCell>{n.etapaNome}</TableCell>
            <TableCell className="tabular-nums">
              {formatarMoeda(n.valorEstimado)}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Temperatura valor={n.temperatura} />
            </TableCell>
            <TableCell className="hidden tabular-nums md:table-cell">
              {n.diasNaEtapa} d
            </TableCell>
            <TableCell
              className={cn(
                "hidden lg:table-cell",
                n.acaoAtrasada && "text-destructive",
              )}
            >
              {n.proximaAcaoDescricao ?? "—"}
              {n.proximaAcaoData
                ? ` · ${formatarData(n.proximaAcaoData)}`
                : null}
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              {n.responsavelNome ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
