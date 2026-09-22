"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Flame } from "lucide-react";

import { formatarData, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartaoNegociacaoData } from "@/components/crm/cartao-negociacao";
import { EstadoVazio, campoClass } from "@/components/crm/pagina";
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
  linha: string | null;
};

const TEMP_LABEL = ["", "Fria", "Morna", "Quente"] as const;

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

const ASC_PADRAO = new Set<SortKey>([
  "titulo",
  "empresaNome",
  "etapaNome",
  "responsavelNome",
]);

function temperaturaNivel(valor: number) {
  return Math.min(3, Math.max(1, valor || 1));
}

function Temperatura({ valor }: { valor: number }) {
  const temp = temperaturaNivel(valor);
  const nome = TEMP_LABEL[temp] ?? "Morna";
  return (
    <span
      className="inline-flex items-center gap-0.5 text-brand-foreground"
      title={`Temperatura ${nome}`}
      aria-label={`Temperatura ${nome}`}
    >
      {Array.from({ length: temp }, (_, i) => (
        <Flame key={i} className="size-3 fill-current" aria-hidden />
      ))}
    </span>
  );
}

function textoDias(dias: number) {
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function rotuloNegociacao(n: LinhaLista): {
  principal: string;
  detalhe: string | null;
} {
  const empresa = n.empresaNome.trim();
  const titulo = n.titulo.trim();
  const emitente = n.emitenteNome?.trim() || null;
  let linha = n.linha?.trim() || null;

  // Título sugerido na criação: `[linha] empresa` (R1). Se a coluna linha
  // estiver vazia, o prefixo do título ainda identifica a linha.
  const prefixo = titulo.match(/^\[(.+?)\]\s+(.+)$/);
  if (!linha && prefixo && prefixo[2] === empresa) {
    linha = prefixo[1] ?? null;
  }

  const padrao = linha ? `[${linha}] ${empresa}` : empresa;
  if (titulo === padrao || titulo === empresa) {
    const partes = [linha, emitente].filter((p): p is string => Boolean(p));
    return {
      principal: empresa || titulo,
      detalhe: partes.length > 0 ? partes.join(" · ") : null,
    };
  }

  const partes = [empresa, linha, emitente].filter((p): p is string =>
    Boolean(p && p !== titulo),
  );
  return {
    principal: titulo,
    detalhe: partes.length > 0 ? partes.join(" · ") : null,
  };
}

function Alertas({ n }: { n: LinhaLista }) {
  if (!n.acaoAtrasada && !n.semAcao && !n.parada) return null;
  return (
    <>
      {n.acaoAtrasada ? <Badge variant="destructive">Atrasada</Badge> : null}
      {n.semAcao ? <Badge variant="warning">Sem ação</Badge> : null}
      {n.parada ? <Badge variant="secondary">Parada</Badge> : null}
    </>
  );
}

function ProximaAcao({ n }: { n: LinhaLista }) {
  const descricao = n.proximaAcaoDescricao?.trim() || null;
  return (
    <div className={cn("min-w-0", n.acaoAtrasada && "text-destructive")}>
      <p
        className={cn(
          "line-clamp-2",
          !descricao && !n.acaoAtrasada && "text-muted-foreground",
        )}
      >
        {descricao ?? "Sem próxima ação"}
      </p>
      {n.proximaAcaoData ? (
        <p
          className={cn(
            "text-xs tabular-nums",
            n.acaoAtrasada ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {formatarData(n.proximaAcaoData)}
        </p>
      ) : null}
    </div>
  );
}

function SortHead({
  label,
  column,
  className,
  align,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  column: SortKey;
  className?: string;
  align?: "right";
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const ativo = sortKey === column;
  const Icon = !ativo ? ArrowUpDown : sortAsc ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn("px-1.5", align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground",
          align === "right" && "w-full justify-end",
        )}
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

  function ordenarPor(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
      return;
    }
    setSortKey(key);
    setSortAsc(ASC_PADRAO.has(key));
  }

  function escolherOrdenacao(key: SortKey) {
    setSortKey(key);
    setSortAsc(ASC_PADRAO.has(key));
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
      <EstadoVazio texto="Nenhuma negociação neste funil com os filtros atuais." />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 px-4 pb-3 sm:px-5 lg:hidden">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-muted-foreground sm:max-w-xs">
          Ordenar por
          <select
            className={campoClass}
            value={sortKey}
            onChange={(e) => escolherOrdenacao(e.target.value as SortKey)}
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

      <ul className="divide-y divide-border lg:hidden">
        {ordenadas.map((n) => {
          const { principal, detalhe } = rotuloNegociacao(n);
          return (
            <li key={n.id} className="flex flex-col gap-1.5 px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/negociacoes/${n.id}`}
                  className="min-w-0 font-medium hover:underline"
                >
                  {principal}
                </Link>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatarMoeda(n.valorEstimado)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {detalhe ? (
                  <span className="text-sm text-muted-foreground">{detalhe}</span>
                ) : null}
                <Badge variant="outline">{n.etapaNome}</Badge>
              </div>
              <ProximaAcao n={n} />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{n.responsavelNome ?? "—"}</span>
                <Temperatura valor={n.temperatura} />
                <span>{textoDias(n.diasNaEtapa)} na etapa</span>
                <Alertas n={n} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden lg:block">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[21%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <SortHead
                label="Negociação"
                column="empresaNome"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={ordenarPor}
              />
              <SortHead
                label="Etapa"
                column="etapaNome"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={ordenarPor}
              />
              <SortHead
                label="Valor"
                column="valorEstimado"
                align="right"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={ordenarPor}
              />
              <SortHead
                label="Temp."
                column="temperatura"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={ordenarPor}
              />
              <SortHead
                label="Dias"
                column="diasNaEtapa"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={ordenarPor}
              />
              <SortHead
                label="Próxima ação"
                column="proximaAcaoData"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={ordenarPor}
              />
              <SortHead
                label="Responsável"
                column="responsavelNome"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={ordenarPor}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenadas.map((n) => {
              const { principal, detalhe } = rotuloNegociacao(n);
              return (
                <TableRow key={n.id}>
                  <TableCell className="px-1.5 whitespace-normal">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/negociacoes/${n.id}`}
                        className="font-medium hover:underline"
                      >
                        {principal}
                      </Link>
                      <Alertas n={n} />
                    </div>
                    {detalhe ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {detalhe}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-1.5 whitespace-normal">
                    <Badge
                      variant="outline"
                      className="h-auto max-w-full min-w-0 shrink py-0.5 whitespace-normal text-left"
                    >
                      {n.etapaNome}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-1.5 text-right font-semibold tabular-nums">
                    {formatarMoeda(n.valorEstimado)}
                  </TableCell>
                  <TableCell className="px-1.5">
                    <Temperatura valor={n.temperatura} />
                  </TableCell>
                  <TableCell className="px-1.5 text-muted-foreground tabular-nums">
                    {textoDias(n.diasNaEtapa)}
                  </TableCell>
                  <TableCell className="px-1.5 whitespace-normal">
                    <ProximaAcao n={n} />
                  </TableCell>
                  <TableCell className="truncate px-1.5 text-muted-foreground">
                    {n.responsavelNome ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
