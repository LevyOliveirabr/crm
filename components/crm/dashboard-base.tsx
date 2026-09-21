"use client";

import { useState } from "react";
import Link from "next/link";

import { rotuloSegmento, type LinhaBase } from "@/lib/dashboard/tipos";
import { formatarData, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";

const LIMITE_INICIAL = 10;

function mesAbrev(mesISO: string | null): string {
  if (!mesISO) return "—";
  const [y, m] = mesISO.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1]}/${y}`;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
  return `${a}${b}`.toUpperCase();
}

const CATEGORIA_LABEL: Record<string, string> = {
  compromisso: "Compromisso",
  provavel: "Provável",
  possivel: "Possível",
};

const TEMP_LABEL: Record<number, string> = {
  1: "Fria",
  2: "Morna",
  3: "Quente",
};

export function DashboardBase({ linhas }: { linhas: LinhaBase[] }) {
  const [todas, setTodas] = useState(false);
  const visiveis = todas ? linhas : linhas.slice(0, LIMITE_INICIAL);
  const totalPotencialVisivel = visiveis.reduce((s, l) => s + l.valor, 0);
  const totalPrevisaoVisivel = visiveis.reduce((s, l) => s + l.valorPrevisao, 0);
  const totalPotencial = linhas.reduce((s, l) => s + l.valor, 0);
  const totalPrevisao = linhas.reduce((s, l) => s + l.valorPrevisao, 0);

  return (
    <section className="card-surface p-4 sm:p-5" aria-label="Base de dados">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold sm:text-lg">Base de dados</h2>
        <span className="text-xs text-muted-foreground">
          negociações abertas dentro dos filtros · clique no nome para abrir a
          ficha
        </span>
      </div>

      {linhas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma negociação aberta dentro dos filtros.
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-input">
                <Th>Oportunidade</Th>
                <Th>Conta</Th>
                <Th>Responsável</Th>
                <Th>Fase</Th>
                <Th>Tipo cliente</Th>
                <Th>Único</Th>
                <Th direita>Potencial</Th>
                <Th direita>Previsão</Th>
                <Th direita>Data prev.</Th>
                <Th direita>Faturamento</Th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-b-0">
                  <Td>
                    <Link
                      href={`/negociacoes/${l.id}`}
                      className="font-semibold hover:underline"
                    >
                      {l.titulo}
                    </Link>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {[l.linha, TEMP_LABEL[l.temperatura], CATEGORIA_LABEL[l.categoriaForecast ?? ""]]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Td>
                  <Td>
                    {l.empresaId ? (
                      <Link
                        href={`/empresas/${l.empresaId}`}
                        className="hover:underline"
                      >
                        {l.empresaNome}
                      </Link>
                    ) : (
                      l.empresaNome
                    )}
                  </Td>
                  <Td>
                    <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {iniciais(l.responsavelNome)}
                    </span>
                    {l.responsavelNome}
                  </Td>
                  <Td>{l.etapaNome}</Td>
                  <Td>
                    {l.tipoCliente ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] uppercase text-muted-foreground">
                        {l.tipoCliente}
                      </span>
                    ) : l.segmento ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] uppercase text-muted-foreground">
                        {rotuloSegmento(l.segmento)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td>
                    {l.negocioUnico ? (
                      <span className="text-xs font-medium">Sim</span>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        Recorrente
                      </span>
                    )}
                  </Td>
                  <Td direita numerico>
                    {formatarMoeda(l.valor)}
                  </Td>
                  <Td direita numerico>
                    {formatarMoeda(l.valorPrevisao)}
                  </Td>
                  <Td direita numerico>
                    {l.previsaoData ? formatarData(l.previsaoData) : mesAbrev(l.previsaoMes)}
                  </Td>
                  <Td direita numerico>
                    {l.dataFaturamento ? formatarData(l.dataFaturamento) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-input font-bold">
                <td colSpan={6} className="px-2.5 py-3">
                  {todas || linhas.length <= LIMITE_INICIAL ? (
                    <>
                      {linhas.length}{" "}
                      {linhas.length === 1 ? "negociação" : "negociações"}
                    </>
                  ) : (
                    <>
                      {visiveis.length} de {linhas.length} negociações
                      <span className="mx-1.5 font-normal opacity-50">·</span>
                      <button
                        type="button"
                        onClick={() => setTodas(true)}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        mostrar todas
                      </button>
                    </>
                  )}
                  {todas && linhas.length > LIMITE_INICIAL ? (
                    <>
                      <span className="mx-1.5 font-normal opacity-50">·</span>
                      <button
                        type="button"
                        onClick={() => setTodas(false)}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        mostrar menos
                      </button>
                    </>
                  ) : null}
                </td>
                <td className="px-2.5 py-3 text-right tabular-nums whitespace-nowrap">
                  {formatarMoeda(todas ? totalPotencial : totalPotencialVisivel)}
                </td>
                <td className="px-2.5 py-3 text-right tabular-nums whitespace-nowrap">
                  {formatarMoeda(todas ? totalPrevisao : totalPrevisaoVisivel)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function Th({
  children,
  direita = false,
}: {
  children: React.ReactNode;
  direita?: boolean;
}) {
  return (
    <th
      className={cn(
        "eyebrow px-2.5 py-2 text-left whitespace-nowrap",
        direita && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  direita = false,
  numerico = false,
}: {
  children: React.ReactNode;
  direita?: boolean;
  numerico?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2.5 py-2.5 align-middle",
        direita && "text-right",
        numerico && "tabular-nums whitespace-nowrap",
      )}
    >
      {children}
    </td>
  );
}
