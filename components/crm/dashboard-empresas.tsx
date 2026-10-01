import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { linkRelatorio } from "@/components/crm/dashboard-paineis";
import type { EmpresaComparativo } from "@/lib/dashboard/tipos";
import { formatarMoeda, formatarMoedaCurta } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Dashboard completo da empresa: override `?emitente=` sem gravar o cookie. */
function linkEmpresa(qs: string, emitenteId: string): string {
  const p = new URLSearchParams(qs);
  p.set("emitente", emitenteId);
  return `/dashboard?${p.toString()}`;
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function pctMeta(l: { vendidoMes: number; metaMes: number }): number | null {
  if (l.metaMes <= 0) return null;
  return Math.round((l.vendidoMes / l.metaMes) * 100);
}

type Totais = Pick<
  EmpresaComparativo,
  "pipeline" | "qtdAbertas" | "previsao" | "forecastMes" | "vendidoMes" | "metaMes" | "qtdEmRisco"
>;

/** Soma das linhas. O win rate do grupo não é média das taxas: fica nos KPIs. */
function totalDe(itens: EmpresaComparativo[]): Totais {
  const soma = (f: (i: EmpresaComparativo) => number) =>
    itens.reduce((s, i) => s + f(i), 0);
  return {
    pipeline: soma((i) => i.pipeline),
    qtdAbertas: soma((i) => i.qtdAbertas),
    previsao: soma((i) => i.previsao),
    forecastMes: soma((i) => i.forecastMes),
    vendidoMes: soma((i) => i.vendidoMes),
    metaMes: soma((i) => i.metaMes),
    qtdEmRisco: soma((i) => i.qtdEmRisco),
  };
}

function BarraParticipacao({ pct }: { pct: number }) {
  return (
    <div className="mt-1 h-1.5 w-full rounded-full bg-muted" aria-hidden>
      <div
        className="h-1.5 rounded-full bg-brand/70"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function BarraMeta({ l }: { l: EmpresaComparativo }) {
  const pct = pctMeta(l);
  if (pct == null) {
    return (
      <p className="text-xs text-muted-foreground">
        {l.vendidoMes > 0 ? `${formatarMoedaCurta(l.vendidoMes)} · sem meta` : "Sem meta"}
      </p>
    );
  }
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums">{pct}%</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatarMoedaCurta(l.vendidoMes)} / {formatarMoedaCurta(l.metaMes)}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 w-full rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        aria-label={`Meta do mês de ${l.nome}`}
      >
        <div
          className={cn("h-1.5 rounded-full", pct >= 100 ? "bg-success" : "bg-brand")}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function WinRate({ v }: { v: number | null }) {
  if (v == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="tabular-nums">{fmtPct(v)}</span>;
}

function Risco({ qtd }: { qtd: number }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        qtd > 0 ? "font-semibold text-destructive" : "text-muted-foreground",
      )}
    >
      {qtd}
    </span>
  );
}

/**
 * Comparativo por empresa vendedora, mostrado só no escopo "Todas". Tabela no
 * desktop, cartões no celular. Clicar na empresa abre o dashboard completo
 * daquela empresa (filtros atuais mantidos).
 */
export function ComparativoEmpresas({
  itens,
  qs,
}: {
  itens: EmpresaComparativo[];
  qs: string;
}) {
  const total = totalDe(itens);
  const colunas = [
    { chave: "empresa", rotulo: "Empresa", alinhar: "left" },
    { chave: "pipeline", rotulo: "Pipeline", alinhar: "right" },
    { chave: "previsao", rotulo: "Previsão", alinhar: "right" },
    { chave: "forecast", rotulo: "Forecast do mês", alinhar: "right" },
    { chave: "meta", rotulo: "Meta do mês", alinhar: "left" },
    { chave: "winrate", rotulo: "Win rate", alinhar: "right" },
    { chave: "risco", rotulo: "Em risco", alinhar: "right" },
  ] as const;

  return (
    <section className="card-surface p-4 sm:p-5" aria-label="Comparativo por empresa vendedora">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold sm:text-lg">Por empresa vendedora</h2>
        <span className="text-xs text-muted-foreground">
          {itens.length} {itens.length === 1 ? "empresa" : "empresas"}
        </span>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Quem contribui com o quê no consolidado. Clique na empresa para ver o
        painel completo dela com os filtros atuais.
      </p>

      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma empresa no escopo.</p>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {colunas.map((c) => (
                    <th
                      key={c.chave}
                      scope="col"
                      className={cn(
                        "eyebrow pb-2 pr-3 font-semibold last:pr-0",
                        c.alinhar === "right" && "text-right",
                        c.chave === "empresa" && "w-[22%]",
                        c.chave === "meta" && "w-[18%]",
                      )}
                    >
                      {c.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {itens.map((l) => (
                  <tr key={l.emitenteId} className="align-top hover:bg-muted/40">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={linkEmpresa(qs, l.emitenteId)}
                        className="group block font-semibold hover:underline"
                      >
                        <span className="truncate">{l.nome}</span>
                        <ArrowRight
                          aria-hidden
                          className="ml-1 inline size-3.5 align-[-2px] opacity-0 transition group-hover:opacity-100"
                        />
                      </Link>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {fmtPct(l.participacaoPct)} do pipeline
                      </p>
                      <BarraParticipacao pct={l.participacaoPct} />
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <Link
                        href={linkRelatorio(qs, "emitente", { chave: l.emitenteId })}
                        className="font-semibold tabular-nums hover:underline"
                        title="Ver as negociações abertas desta empresa"
                      >
                        {formatarMoedaCurta(l.pipeline)}
                      </Link>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {l.qtdAbertas} {l.qtdAbertas === 1 ? "negócio" : "negócios"}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                      {formatarMoedaCurta(l.previsao)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                      {formatarMoedaCurta(l.forecastMes)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <BarraMeta l={l} />
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold">
                      <WinRate v={l.winRate} />
                    </td>
                    <td className="py-2.5 text-right">
                      <Risco qtd={l.qtdEmRisco} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="pt-2.5 pr-3">Total</td>
                  <td className="pt-2.5 pr-3 text-right tabular-nums">
                    {formatarMoedaCurta(total.pipeline)}
                    <p className="text-xs font-normal text-muted-foreground tabular-nums">
                      {total.qtdAbertas} {total.qtdAbertas === 1 ? "negócio" : "negócios"}
                    </p>
                  </td>
                  <td className="pt-2.5 pr-3 text-right tabular-nums">
                    {formatarMoedaCurta(total.previsao)}
                  </td>
                  <td className="pt-2.5 pr-3 text-right tabular-nums">
                    {formatarMoedaCurta(total.forecastMes)}
                  </td>
                  <td className="pt-2.5 pr-3 text-xs font-normal text-muted-foreground tabular-nums">
                    {total.metaMes > 0
                      ? `${pctMeta(total)}% · ${formatarMoeda(total.vendidoMes)} de ${formatarMoeda(total.metaMes)}`
                      : formatarMoeda(total.vendidoMes)}
                  </td>
                  <td className="pt-2.5 pr-3 text-right text-xs font-normal text-muted-foreground">
                    ver KPIs
                  </td>
                  <td className="pt-2.5 text-right">
                    <Risco qtd={total.qtdEmRisco} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Celular: cartões */}
          <ul className="space-y-3 md:hidden">
            {itens.map((l) => (
              <li key={l.emitenteId} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={linkEmpresa(qs, l.emitenteId)}
                    className="min-w-0 flex-1 font-semibold hover:underline"
                  >
                    <span className="block truncate">{l.nome}</span>
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {fmtPct(l.participacaoPct)} do pipeline
                    </span>
                  </Link>
                  <Link
                    href={linkEmpresa(qs, l.emitenteId)}
                    aria-label={`Abrir painel de ${l.nome}`}
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
                <BarraParticipacao pct={l.participacaoPct} />
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="eyebrow">Pipeline</dt>
                    <dd className="font-semibold tabular-nums">
                      <Link
                        href={linkRelatorio(qs, "emitente", { chave: l.emitenteId })}
                        className="hover:underline"
                      >
                        {formatarMoedaCurta(l.pipeline)}
                      </Link>{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({l.qtdAbertas})
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Previsão</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatarMoedaCurta(l.previsao)}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Forecast do mês</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatarMoedaCurta(l.forecastMes)}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Win rate</dt>
                    <dd className="font-semibold">
                      <WinRate v={l.winRate} />
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="eyebrow">Meta do mês</dt>
                    <dd className="mt-0.5">
                      <BarraMeta l={l} />
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Em risco</dt>
                    <dd className="font-semibold">
                      <Risco qtd={l.qtdEmRisco} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
            <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatarMoedaCurta(total.pipeline)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({total.qtdAbertas})
                </span>
              </span>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
