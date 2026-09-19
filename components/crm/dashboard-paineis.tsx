import Link from "next/link";
import { TrendingDown } from "lucide-react";

import type {
  BarraTrimestre,
  FunilDashboard,
  Kpis,
  NegociacaoResumo,
  VisaoData,
} from "@/lib/dashboard/tipos";
import { formatarMoedaCurta, mesPorExtenso } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- */
/* Cards de KPI                                                      */
/* ---------------------------------------------------------------- */

function mesCurto(mesISO: string): string {
  const nome = mesPorExtenso(mesISO).split(" ")[0] ?? "";
  return nome;
}

function fmtPts(v: number): string {
  const s = Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${v > 0 ? "▲" : "▼"} ${s} pts`;
}

function fmtPct(v: number): string {
  const s = Math.abs(Math.round(v)).toLocaleString("pt-BR");
  return `${v > 0 ? "▲" : "▼"} ${s}%`;
}

function Kpi({
  label,
  valor,
  detalhe,
  tom,
  destaque = false,
}: {
  label: string;
  valor: string;
  detalhe: string;
  tom?: "ok" | "ruim";
  destaque?: boolean;
}) {
  return (
    <div
      role="listitem"
      className={cn(
        "card-surface flex flex-col justify-center px-4 py-3.5",
        destaque && "border-primary bg-primary text-primary-foreground",
      )}
    >
      <p
        className={cn(
          "eyebrow",
          destaque && "text-primary-foreground/65",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-heading text-2xl font-semibold tracking-tight tabular-nums",
          destaque && "text-brand",
        )}
      >
        {valor}
      </p>
      <p
        className={cn(
          "mt-0.5 text-xs text-muted-foreground",
          destaque && "text-primary-foreground/70",
          tom === "ok" && "font-medium text-success",
          tom === "ruim" && "font-medium text-destructive",
        )}
      >
        {detalhe}
      </p>
    </div>
  );
}

export function KpisDashboard({ kpis }: { kpis: Kpis }) {
  const pctPonderado =
    kpis.pipelineTotal > 0
      ? Math.round((kpis.pipelinePonderado / kpis.pipelineTotal) * 100)
      : 0;

  const deltaWin =
    kpis.winRate != null && kpis.winRateAnterior != null
      ? kpis.winRate - kpis.winRateAnterior
      : null;

  const deltaTri =
    kpis.forecastTrimestreAnterior > 0
      ? ((kpis.forecastTrimestre - kpis.forecastTrimestreAnterior) /
          kpis.forecastTrimestreAnterior) *
        100
      : null;

  const negocios = (n: number) => `${n} ${n === 1 ? "negócio" : "negócios"}`;

  return (
    <div
      role="list"
      aria-label="Indicadores"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-1"
    >
      <Kpi
        destaque
        label="Pipeline total"
        valor={formatarMoedaCurta(kpis.pipelineTotal)}
        detalhe={`${kpis.qtdAbertas} ${kpis.qtdAbertas === 1 ? "negociação aberta" : "negociações abertas"}`}
      />
      <Kpi
        label="Pipeline ponderado"
        valor={formatarMoedaCurta(kpis.pipelinePonderado)}
        detalhe={`${pctPonderado}% do total`}
      />
      <Kpi
        label="Win rate"
        valor={
          kpis.winRate == null
            ? "—"
            : `${kpis.winRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
        }
        detalhe={
          deltaWin == null
            ? kpis.winRate == null
              ? "sem fechamentos no período"
              : `${kpis.qtdVendidas} ganhas · ${kpis.qtdPerdidas} perdidas`
            : `${fmtPts(deltaWin)} vs. período anterior`
        }
        tom={deltaWin == null ? undefined : deltaWin >= 0 ? "ok" : "ruim"}
      />
      <Kpi
        label="Forecast mês corrente"
        valor={formatarMoedaCurta(kpis.forecastMes)}
        detalhe={`${mesCurto(kpis.mesAtual)} · ${negocios(kpis.forecastMesQtd)}`}
      />
      <Kpi
        label="Forecast mês seguinte"
        valor={formatarMoedaCurta(kpis.forecastMesSeguinte)}
        detalhe={`${mesCurto(kpis.mesSeguinte)} · ${negocios(kpis.forecastMesSeguinteQtd)}`}
      />
      <Kpi
        label="Forecast do trimestre"
        valor={formatarMoedaCurta(kpis.forecastTrimestre)}
        detalhe={
          deltaTri == null
            ? negocios(kpis.forecastTrimestreQtd)
            : `${fmtPct(deltaTri)} vs. trimestre anterior`
        }
        tom={deltaTri == null ? undefined : deltaTri >= 0 ? "ok" : "ruim"}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Gráfico de barras por trimestre (SVG)                             */
/* ---------------------------------------------------------------- */

const VISAO_ROTULO: Record<VisaoData, string> = {
  previsao: "por trimestre de previsão",
  criacao: "por trimestre de criação",
  fechamento: "vendas por trimestre de fechamento",
};

function unidade(max: number): { div: number; rotulo: string; casas: number } {
  if (max >= 1_000_000) return { div: 1_000_000, rotulo: "R$ milhões", casas: 1 };
  if (max >= 1_000) return { div: 1_000, rotulo: "R$ mil", casas: 0 };
  return { div: 1, rotulo: "R$", casas: 0 };
}

function passoBonito(max: number): number {
  if (max <= 0) return 1;
  const bruto = max / 4;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / pot;
  const passo = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return passo * pot;
}

export function GraficoTrimestres({
  barras,
  visao,
}: {
  barras: BarraTrimestre[];
  visao: VisaoData;
}) {
  const W = 560;
  const H = 250;
  const padL = 44;
  const padR = 12;
  const topo = 30;
  const baseY = 200;

  const max = Math.max(0, ...barras.map((b) => b.valor));
  const u = unidade(max);
  const maxU = max / u.div;
  const passo = passoBonito(maxU);
  const topoEscala = Math.max(passo, Math.ceil(maxU / passo) * passo);
  const ticks: number[] = [];
  for (let t = passo; t <= topoEscala + 1e-9; t += passo) ticks.push(t);

  const y = (v: number) => baseY - (v / u.div / topoEscala) * (baseY - topo);

  const anos = [...new Set(barras.map((b) => b.ano))];
  const grupoW = (W - padL - padR) / anos.length;
  const barraSlot = grupoW / 4;
  const barraW = Math.min(36, barraSlot * 0.6);

  const fmtValor = (v: number) =>
    (v / u.div).toLocaleString("pt-BR", {
      minimumFractionDigits: u.casas,
      maximumFractionDigits: u.casas,
    });

  const vazio = max === 0;

  return (
    <section className="card-surface p-4 sm:p-5" aria-label="Pipeline de vendas por trimestre">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold sm:text-lg">Pipeline de vendas</h2>
        <span className="text-xs text-muted-foreground">
          {VISAO_ROTULO[visao]} · {u.rotulo}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`Pipeline por trimestre, ${anos[0]} a ${anos[anos.length - 1]}`}
      >
        <g>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(t * u.div)}
                y2={y(t * u.div)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={y(t * u.div) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {t.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              </text>
            </g>
          ))}
          <line
            x1={padL}
            x2={W - padR}
            y1={baseY}
            y2={baseY}
            className="stroke-input"
            strokeWidth={1}
          />
        </g>

        {barras.map((b, i) => {
          const gi = anos.indexOf(b.ano);
          const cx = padL + gi * grupoW + (b.trimestre - 1) * barraSlot + barraSlot / 2;
          const topoBarra = y(b.valor);
          const altura = Math.max(0, baseY - topoBarra);
          const titulo = `T${b.trimestre} ${b.ano} · ${formatarMoedaCurta(b.valor)} · ${b.qtd} ${b.qtd === 1 ? "negócio" : "negócios"}`;
          return (
            <g key={i}>
              <title>{titulo}</title>
              <rect
                x={cx - barraSlot / 2}
                y={topo}
                width={barraSlot}
                height={baseY - topo}
                fill="transparent"
              />
              {b.valor > 0 ? (
                <rect
                  x={cx - barraW / 2}
                  y={topoBarra}
                  width={barraW}
                  height={altura}
                  rx={4}
                  className={cn(
                    b.atual
                      ? "fill-brand"
                      : b.futuro
                        ? "fill-chart-4"
                        : "fill-chart-2",
                  )}
                />
              ) : (
                <rect
                  x={cx - barraW / 2}
                  y={baseY - 2}
                  width={barraW}
                  height={2}
                  className="fill-border"
                />
              )}
              {b.valor > 0 ? (
                <text
                  x={cx}
                  y={topoBarra - 7}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-semibold tabular-nums"
                >
                  {fmtValor(b.valor)}
                </text>
              ) : null}
              <text
                x={cx}
                y={baseY + 18}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                T{b.trimestre}
              </text>
            </g>
          );
        })}

        {anos.map((ano, gi) => (
          <g key={ano}>
            {gi > 0 ? (
              <line
                x1={padL + gi * grupoW}
                x2={padL + gi * grupoW}
                y1={baseY + 6}
                y2={H - 6}
                className="stroke-input"
                strokeWidth={1}
              />
            ) : null}
            <text
              x={padL + gi * grupoW + grupoW / 2}
              y={H - 8}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-bold"
            >
              {ano}
            </text>
          </g>
        ))}

        {vazio ? (
          <text
            x={padL + (W - padL - padR) / 2}
            y={(topo + baseY) / 2}
            textAnchor="middle"
            className="fill-muted-foreground text-[12px]"
          >
            Nenhuma negociação dentro dos filtros.
          </text>
        ) : null}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-[3px] bg-chart-2" />
          Trimestres passados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-[3px] bg-brand" />
          Trimestre atual
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-[3px] bg-chart-4" />
          Trimestres futuros
        </span>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Funil por estágio                                                 */
/* ---------------------------------------------------------------- */

const TONS_FUNIL = [
  "bg-chart-5",
  "bg-chart-4",
  "bg-chart-3",
  "bg-chart-2",
  "bg-brand",
];

export function FunilEstagios({ funis }: { funis: FunilDashboard[] }) {
  const lista = funis.filter((f) => f.etapas.length > 0);
  return (
    <section className="card-surface p-4 sm:p-5" aria-label="Pipeline por estágio">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold sm:text-lg">Por estágio</h2>
        <span className="text-xs text-muted-foreground">negociações abertas</span>
      </div>

      {lista.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum funil ativo cadastrado.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {lista.map((f) => {
            const max = Math.max(1, ...f.etapas.map((e) => e.valor));
            const n = f.etapas.length;
            return (
              <div key={f.funilId}>
                {lista.length > 1 ? (
                  <p className="eyebrow mb-2">{f.nome}</p>
                ) : null}
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2">
                  {f.etapas.map((e, i) => {
                    const pct = Math.max(4, Math.round((e.valor / max) * 100));
                    // Tom escurece conforme avança no funil; a última etapa é amarela.
                    const tom =
                      i === n - 1
                        ? TONS_FUNIL[4]
                        : TONS_FUNIL[Math.min(3, Math.floor((i / Math.max(1, n - 1)) * 4))];
                    return (
                      <div key={e.etapaId} className="contents">
                        <div className="min-w-0 text-xs font-semibold">
                          <span className="block truncate">{e.nome}</span>
                          <span className="block text-[11px] font-medium text-muted-foreground">
                            {e.qtd} {e.qtd === 1 ? "negócio" : "negócios"}
                          </span>
                        </div>
                        <div className="flex h-6 justify-center">
                          <div
                            className={cn("h-full rounded-md", tom)}
                            style={{ width: e.valor > 0 ? `${pct}%` : "6px" }}
                            title={`${e.nome}: ${formatarMoedaCurta(e.valor)}`}
                          />
                        </div>
                        <div className="text-right text-sm font-semibold tabular-nums">
                          {formatarMoedaCurta(e.valor)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-between border-t border-border pt-2.5 text-xs text-muted-foreground">
                  <span>
                    {f.qtd} {f.qtd === 1 ? "negociação aberta" : "negociações abertas"}
                  </span>
                  <b className="text-foreground tabular-nums">
                    {formatarMoedaCurta(f.total)}
                  </b>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Listas: próximos fechamentos / em risco                          */
/* ---------------------------------------------------------------- */

function mesAbrev(mesISO: string | null): string {
  if (!mesISO) return "sem previsão";
  const [y, m] = mesISO.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1]}/${y}`;
}

export function ListaNegociacoes({
  titulo,
  pill,
  tom,
  itens,
  vazio,
}: {
  titulo: string;
  pill: string;
  tom: "ok" | "risco";
  itens: NegociacaoResumo[];
  vazio: string;
}) {
  return (
    <section className="card-surface p-4 sm:p-5" aria-label={titulo}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold sm:text-lg">{titulo}</h2>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-[0.1em] uppercase",
            tom === "ok"
              ? "bg-success-bg text-success"
              : "bg-danger-bg text-destructive",
          )}
        >
          {pill}
        </span>
      </div>
      {itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <TrendingDown className="size-5 opacity-50" />
          {vazio}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-3 py-2.5 first:pt-1 last:pb-0"
            >
              <div className="min-w-0">
                <Link
                  href={`/negociacoes/${n.id}`}
                  className="block text-sm font-semibold leading-snug hover:underline"
                >
                  <i
                    aria-hidden
                    className={cn(
                      "mr-1.5 inline-block size-2 rounded-full align-middle",
                      tom === "ok" ? "bg-brand" : "bg-destructive",
                    )}
                  />
                  {n.titulo}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {n.empresaNome}
                  <span className="mx-1 opacity-50">·</span>
                  {tom === "risco" && n.motivo ? n.motivo : n.etapaNome}
                  {tom === "ok" ? (
                    <>
                      <span className="mx-1 opacity-50">·</span>
                      {n.responsavelNome}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                {formatarMoedaCurta(n.valor)}
                <span className="block text-[11px] font-medium text-muted-foreground">
                  {tom === "ok"
                    ? `previsto ${mesAbrev(n.previsaoMes)}`
                    : n.diasSemInteracao != null
                      ? `parada há ${n.diasSemInteracao} ${n.diasSemInteracao === 1 ? "dia" : "dias"}`
                      : mesAbrev(n.previsaoMes)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
