"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Download, Printer } from "lucide-react";

import { salvarComentarioPresidencia } from "@/lib/actions/config";
import { baixarCsv } from "@/lib/relatorios/csv";
import { textoWhatsAppPresidencia } from "@/lib/relatorios/dados";
import {
  deltaPct,
  formatarDeltaPct,
  rotuloMesCurto,
  type TipoPeriodo,
} from "@/lib/relatorios/periodo";
import type { DadosRelatorios } from "@/lib/relatorios/tipos";
import { useState, useTransition } from "react";

import { salvarComentarioDiretor } from "@/lib/actions/config";
import {
  formatarData,
  formatarMoeda,
  formatarMoedaCurta,
  inicioMesISO,
  mesPorExtenso,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Toaster, toast } from "@/components/ui/toast";

export type AbaRelatorio =
  | "presidencia"
  | "funil"
  | "previsao"
  | "ranking"
  | "perdas"
  | "carteira";

type VendedorOption = { id: string; nome: string };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function DeltaBadge({ atual, anterior }: { atual: number; anterior: number }) {
  const d = deltaPct(atual, anterior);
  if (d == null) {
    return <span className="text-xs text-muted-foreground">Δ —</span>;
  }
  const cor =
    d > 0 ? "text-emerald-700" : d < 0 ? "text-destructive" : "text-muted-foreground";
  return <span className={`text-xs font-medium ${cor}`}>Δ {formatarDeltaPct(d)}</span>;
}

function Barra({
  valor,
  max,
  className = "bg-foreground/80",
}: {
  valor: number;
  max: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((valor / max) * 100)) : 0;
  return (
    <div className="h-2 w-full min-w-[4rem] rounded-full bg-muted">
      <div
        className={`h-2 rounded-full ${className}`}
        style={{ width: `${pct}%` }}
        title={`${pct}%`}
      />
    </div>
  );
}

function ExportarCsvButton({
  nome,
  colunas,
  linhas,
}: {
  nome: string;
  colunas: { chave: string; titulo: string }[];
  linhas: Record<string, unknown>[];
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="print:hidden"
      onClick={() => baixarCsv(nome, colunas, linhas)}
    >
      <Download className="size-4" />
      Exportar CSV
    </Button>
  );
}

function SortHead({
  id,
  children,
  className,
  sortKey,
  sortDir,
  onToggle,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  onToggle: (key: string) => void;
}) {
  const active = sortKey === id;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        onClick={() => onToggle(id)}
      >
        {children}
        <Icon className="size-3.5 opacity-60" />
      </button>
    </TableHead>
  );
}

export function RelatoriosClient({
  dados,
  isDiretor,
  vendedores,
  linhasOpcoes,
  origensOpcoes,
  filtros,
  abaInicial,
}: {
  dados: DadosRelatorios;
  isDiretor: boolean;
  vendedores: VendedorOption[];
  linhasOpcoes: string[];
  origensOpcoes: string[];
  filtros: {
    periodo: TipoPeriodo;
    mes: string;
    de: string;
    ate: string;
    vendedor: string | null;
    linha: string | null;
    origem: string | null;
    rotuloPeriodo: string;
  };
  abaInicial: AbaRelatorio;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<AbaRelatorio>(abaInicial);
  const [comentario, setComentario] = useState(
    dados.presidencia?.comentario ?? "",
  );
  const [motivoAberto, setMotivoAberto] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("vendido");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setParams(entries: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(entries)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onAbaChange(next: string | number | null) {
    const valor = String(next ?? "presidencia") as AbaRelatorio;
    setAba(valor);
    setParam("aba", valor === "presidencia" ? null : valor);
  }

  const rankingSorted = useMemo(() => {
    const rows = [...dados.ranking];
    rows.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      const an = typeof av === "number" ? av : String(av ?? "");
      const bn = typeof bv === "number" ? bv : String(bv ?? "");
      if (typeof an === "number" && typeof bn === "number") {
        return sortDir === "asc" ? an - bn : bn - an;
      }
      return sortDir === "asc"
        ? String(an).localeCompare(String(bn), "pt-BR")
        : String(bn).localeCompare(String(an), "pt-BR");
    });
    return rows;
  }, [dados.ranking, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nome" ? "asc" : "desc");
    }
  }

  const p = dados.presidencia;
  const maxFunil = Math.max(1, ...dados.funil.map((f) => f.valor));
  const maxPrev = Math.max(1, ...dados.previsao.map((f) => f.otimista || f.aberto));
  const maxPerda = Math.max(1, ...dados.perdas.map((f) => f.valor));
  const totalPrev = dados.previsao.reduce(
    (acc, r) => ({
      aberto: acc.aberto + r.aberto,
      realista: acc.realista + r.realista,
      otimista: acc.otimista + r.otimista,
      qtd: acc.qtd + r.qtd,
    }),
    { aberto: 0, realista: 0, otimista: 0, qtd: 0 },
  );

  const perdasDoMotivo = motivoAberto
    ? dados.perdasDetalhe.filter((d) => d.motivo_perda === motivoAberto)
    : [];

  const abas: { id: AbaRelatorio; label: string; hide?: boolean }[] = [
    { id: "presidencia", label: "Presidência" },
    { id: "funil", label: "Funil" },
    { id: "previsao", label: "Previsão" },
    { id: "ranking", label: "Ranking", hide: !isDiretor },
    { id: "perdas", label: "Perdas" },
    { id: "carteira", label: "Carteira parada" },
  ];

  return (
    <Toaster>
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-3 print:hidden">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Relatórios</h1>
              <p className="text-sm text-muted-foreground">
                Período: {filtros.rotuloPeriodo}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filtro-periodo" className="text-sm font-medium">
                Período
              </label>
              <select
                id="filtro-periodo"
                className={selectClass}
                value={filtros.periodo}
                onChange={(e) =>
                  setParams({
                    periodo: e.target.value === "mes" ? null : e.target.value,
                  })
                }
              >
                <option value="mes">Mês</option>
                <option value="trimestre">Trimestre</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            {filtros.periodo !== "personalizado" ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="filtro-mes" className="text-sm font-medium">
                  {filtros.periodo === "trimestre" ? "Referência" : "Mês"}
                </label>
                <input
                  id="filtro-mes"
                  type="month"
                  className={selectClass}
                  value={filtros.mes.slice(0, 7)}
                  onChange={(e) =>
                    setParam("mes", e.target.value ? `${e.target.value}-01` : null)
                  }
                />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="filtro-de" className="text-sm font-medium">
                    De
                  </label>
                  <input
                    id="filtro-de"
                    type="date"
                    className={selectClass}
                    value={filtros.de}
                    onChange={(e) => setParam("de", e.target.value || null)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="filtro-ate" className="text-sm font-medium">
                    Até
                  </label>
                  <input
                    id="filtro-ate"
                    type="date"
                    className={selectClass}
                    value={filtros.ate}
                    onChange={(e) => setParam("ate", e.target.value || null)}
                  />
                </div>
              </>
            )}

            {isDiretor ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="filtro-vendedor" className="text-sm font-medium">
                  Vendedor
                </label>
                <select
                  id="filtro-vendedor"
                  className={selectClass}
                  value={filtros.vendedor ?? "todos"}
                  onChange={(e) =>
                    setParam(
                      "vendedor",
                      e.target.value === "todos" ? null : e.target.value,
                    )
                  }
                >
                  <option value="todos">Todos</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="filtro-linha" className="text-sm font-medium">
                Linha
              </label>
              <select
                id="filtro-linha"
                className={selectClass}
                value={filtros.linha ?? "todas"}
                onChange={(e) =>
                  setParam("linha", e.target.value === "todas" ? null : e.target.value)
                }
              >
                <option value="todas">Todas</option>
                {linhasOpcoes.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="filtro-origem" className="text-sm font-medium">
                Origem
              </label>
              <select
                id="filtro-origem"
                className={selectClass}
                value={filtros.origem ?? "todas"}
                onChange={(e) =>
                  setParam(
                    "origem",
                    e.target.value === "todas" ? null : e.target.value,
                  )
                }
              >
                <option value="todas">Todas</option>
                {origensOpcoes.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <Tabs value={aba} onValueChange={onAbaChange}>
          <TabsList
            variant="line"
            className="print:hidden h-auto w-full flex-wrap justify-start gap-1"
          >
            {abas
              .filter((a) => !a.hide)
              .map((a) => (
                <TabsTrigger key={a.id} value={a.id} className="px-3">
                  {a.label}
                </TabsTrigger>
              ))}
          </TabsList>

          {/* ——— Presidência ——— */}
          <TabsContent value="presidencia" className="mt-4">
            {!p ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2 print:hidden">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                  >
                    <Printer className="size-4" />
                    Imprimir / PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const texto = textoWhatsAppPresidencia(p);
                      try {
                        await navigator.clipboard.writeText(texto);
                        toast.add({
                          title: "Copiado",
                          description: "Texto pronto para colar no WhatsApp.",
                          type: "success",
                        });
                      } catch {
                        toast.add({
                          title: "Não foi possível copiar",
                          type: "error",
                        });
                      }
                    }}
                  >
                    <Copy className="size-4" />
                    Copiar como texto
                  </Button>
                  <ExportarCsvButton
                    nome={`presidencia-${p.mes.slice(0, 7)}`}
                    colunas={[
                      { chave: "campo", titulo: "Campo" },
                      { chave: "valor", titulo: "Valor" },
                    ]}
                    linhas={[
                      { campo: "Vendido", valor: p.vendido },
                      { campo: "Qtd vendida", valor: p.qtd_vendida },
                      { campo: "Ticket médio", valor: p.ticket_medio },
                      { campo: "Perdido", valor: p.perdido },
                      { campo: "Qtd perdida", valor: p.qtd_perdida },
                      { campo: "Conversão %", valor: p.conversao_pct },
                      { campo: "Δ% vs mês anterior", valor: p.variacao_pct },
                    ]}
                  />
                </div>

                <article className="relatorio-print mx-auto w-full max-w-[210mm] space-y-6 rounded-lg border border-border bg-background p-4 sm:p-6 print:border-0 print:p-0">
                  <header className="space-y-1 border-b border-border pb-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      F-Led · Relatório da Presidência
                    </p>
                    <h2 className="text-2xl font-semibold capitalize">
                      {mesPorExtenso(p.mes)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Gerado em {formatarData(new Date())}
                    </p>
                  </header>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Resultado do mês
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Vendido</p>
                        <p className="text-xl font-semibold">
                          {formatarMoeda(p.vendido)}
                        </p>
                        <DeltaBadge
                          atual={p.vendido}
                          anterior={p.vendido_mes_anterior}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Negócios / ticket
                        </p>
                        <p className="text-xl font-semibold">
                          {p.qtd_vendida} · {formatarMoedaCurta(p.ticket_medio)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Perdido</p>
                        <p className="text-lg font-medium">
                          {formatarMoeda(p.perdido)}{" "}
                          <span className="text-sm text-muted-foreground">
                            ({p.qtd_perdida})
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Conversão</p>
                        <p className="text-lg font-medium">
                          {p.conversao_pct != null ? `${p.conversao_pct}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Previsão de fechamento
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {p.previsao.map((prev, idx) => (
                        <li key={prev.mes} className="flex flex-wrap gap-x-2">
                          <span className="w-28 font-medium">
                            {rotuloMesCurto(inicioMesISO(prev.mes))}
                            {idx === 0 ? " (restante)" : ""}
                          </span>
                          <span>
                            {formatarMoedaCurta(prev.realista)} realista /{" "}
                            {formatarMoedaCurta(prev.otimista)} otimista
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Maiores negociações em andamento
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {p.top_negociacoes.map((t, i) => (
                        <li key={`${t.titulo}-${i}`}>
                          <span className="font-medium">{t.empresa_nome}</span>
                          {" – "}
                          {formatarMoedaCurta(t.valor_estimado)}
                          {" – "}
                          {t.etapa_nome}
                          {t.proxima_acao_descricao
                            ? ` – ${t.proxima_acao_descricao}${
                                t.proxima_acao_data
                                  ? ` ${formatarData(t.proxima_acao_data)}`
                                  : ""
                              }`
                            : ""}
                        </li>
                      ))}
                      {p.top_negociacoes.length === 0 ? (
                        <li className="text-muted-foreground">Nenhuma aberta.</li>
                      ) : null}
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Perdas do mês
                    </h3>
                    <p className="text-sm">
                      {p.perdas.length
                        ? p.perdas
                            .map((x) => `${x.motivo_perda} (${x.qtd})`)
                            .join(", ")
                        : "—"}
                    </p>
                  </section>

                  <section className="space-y-2 print:break-inside-avoid">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Comentário do diretor
                    </h3>
                    {isDiretor ? (
                      <div className="space-y-2 print:hidden">
                        <Textarea
                          value={comentario}
                          onChange={(e) => setComentario(e.target.value)}
                          rows={4}
                          placeholder="Observações para a presidência…"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              const res = await salvarComentarioPresidencia(
                                p.mes,
                                comentario,
                              );
                              if (res.error) {
                                toast.add({
                                  title: res.error,
                                  type: "error",
                                });
                              } else {
                                toast.add({
                                  title: "Comentário salvo",
                                  type: "success",
                                });
                              }
                            });
                          }}
                        >
                          Salvar comentário
                        </Button>
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm">
                      {comentario || "—"}
                    </p>
                  </section>
                </article>
              </div>
            )}
          </TabsContent>

          {/* ——— Funil ——— */}
          <TabsContent value="funil" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                Total: {dados.totais.funilQtd} neg. ·{" "}
                {formatarMoeda(dados.totais.funilValor)}
              </div>
              <ExportarCsvButton
                nome="funil"
                colunas={[
                  { chave: "funil", titulo: "Funil" },
                  { chave: "etapa", titulo: "Etapa" },
                  { chave: "qtd", titulo: "Qtd" },
                  { chave: "valor", titulo: "Valor" },
                ]}
                linhas={dados.funil}
              />
            </div>
            {[...new Set(dados.funil.map((f) => f.funil))].map((funilNome) => {
              const etapas = dados.funil
                .filter((f) => f.funil === funilNome)
                .sort((a, b) => a.ordem - b.ordem);
              return (
                <section key={funilNome} className="space-y-2">
                  <h2 className="text-base font-semibold">{funilNome}</h2>
                  <ul className="space-y-2">
                    {etapas.map((et) => (
                      <li key={et.etapa_id} className="space-y-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="font-medium">{et.etapa}</span>
                          <span className="text-muted-foreground">
                            {et.qtd} · {formatarMoeda(et.valor)}
                          </span>
                        </div>
                        <Barra valor={et.valor} max={maxFunil} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {dados.funil.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma etapa.</p>
            ) : null}
          </TabsContent>

          {/* ——— Previsão ——— */}
          <TabsContent value="previsao" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <ExportarCsvButton
                nome="previsao"
                colunas={[
                  { chave: "mes", titulo: "Mês" },
                  { chave: "aberto", titulo: "Aberto" },
                  { chave: "realista", titulo: "Realista" },
                  { chave: "otimista", titulo: "Otimista" },
                  { chave: "qtd", titulo: "Qtd" },
                ]}
                linhas={dados.previsao.map((r) => ({
                  ...r,
                  mes: rotuloMesCurto(r.mes),
                }))}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Aberto</TableHead>
                  <TableHead className="text-right">Realista</TableHead>
                  <TableHead className="text-right">Otimista</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="min-w-[8rem]">Barras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.previsao.map((r) => (
                  <TableRow key={r.mes}>
                    <TableCell className="font-medium">
                      {rotuloMesCurto(r.mes)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatarMoeda(r.aberto)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatarMoeda(r.realista)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatarMoeda(r.otimista)}
                    </TableCell>
                    <TableCell className="text-right">{r.qtd}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Barra
                          valor={r.realista}
                          max={maxPrev}
                          className="bg-foreground/70"
                        />
                        <Barra
                          valor={r.otimista}
                          max={maxPrev}
                          className="bg-foreground/30"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {formatarMoeda(totalPrev.aberto)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatarMoeda(totalPrev.realista)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatarMoeda(totalPrev.otimista)}
                  </TableCell>
                  <TableCell className="text-right">{totalPrev.qtd}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </TabsContent>

          {/* ——— Ranking ——— */}
          {isDiretor ? (
            <TabsContent value="ranking" className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Vendido total:{" "}
                  {formatarMoeda(
                    rankingSorted.reduce((s, r) => s + r.vendido, 0),
                  )}{" "}
                  <DeltaBadge
                    atual={rankingSorted.reduce((s, r) => s + r.vendido, 0)}
                    anterior={rankingSorted.reduce(
                      (s, r) => s + r.vendido_ant,
                      0,
                    )}
                  />
                </p>
                <ExportarCsvButton
                  nome="ranking"
                  colunas={[
                    { chave: "nome", titulo: "Vendedor" },
                    { chave: "vendido", titulo: "Vendido" },
                    { chave: "qtd", titulo: "Qtd" },
                    { chave: "aberto", titulo: "Aberto" },
                    { chave: "conversao_pct", titulo: "Conversão %" },
                    { chave: "interacoes", titulo: "Interações" },
                    { chave: "pct_com_acao", titulo: "% com ação" },
                    { chave: "acoes_atrasadas", titulo: "Ações atrasadas" },
                  ]}
                  linhas={rankingSorted}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead id="nome" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort}>
                      Vendedor
                    </SortHead>
                    <SortHead
                      id="vendido"
                      className="text-right"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Vendido
                    </SortHead>
                    <SortHead
                      id="qtd"
                      className="text-right"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Qtd
                    </SortHead>
                    <SortHead
                      id="aberto"
                      className="text-right"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Aberto
                    </SortHead>
                    <SortHead
                      id="conversao_pct"
                      className="text-right"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Conversão
                    </SortHead>
                    <SortHead
                      id="interacoes"
                      className="text-right"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Interações
                    </SortHead>
                    <SortHead
                      id="pct_com_acao"
                      className="text-right"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      % c/ ação
                    </SortHead>
                    <SortHead
                      id="acoes_atrasadas"
                      className="text-right"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Atrasadas
                    </SortHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingSorted.map((r) => (
                    <TableRow
                      key={r.responsavel_id}
                      className={!r.ativo ? "text-muted-foreground opacity-60" : undefined}
                    >
                      <TableCell className="font-medium">
                        {r.nome}
                        {!r.ativo ? (
                          <span className="ml-1 text-xs">(inativo)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          {formatarMoeda(r.vendido)}
                          <DeltaBadge atual={r.vendido} anterior={r.vendido_ant} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{r.qtd}</TableCell>
                      <TableCell className="text-right">
                        {formatarMoeda(r.aberto)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.conversao_pct != null ? `${r.conversao_pct}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          {r.interacoes}
                          <DeltaBadge
                            atual={r.interacoes}
                            anterior={r.interacoes_ant}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.pct_com_acao != null ? `${r.pct_com_acao}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.acoes_atrasadas}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          ) : null}

          {/* ——— Perdas ——— */}
          <TabsContent value="perdas" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {dados.totais.perdasQtd} perdas ·{" "}
                {formatarMoeda(dados.totais.perdasValor)}{" "}
                <DeltaBadge
                  atual={dados.totais.perdasValor}
                  anterior={dados.totais.perdasValorAnt}
                />
              </p>
              <ExportarCsvButton
                nome="perdas"
                colunas={[
                  { chave: "motivo", titulo: "Motivo" },
                  { chave: "qtd", titulo: "Qtd" },
                  { chave: "valor", titulo: "Valor" },
                  { chave: "pct", titulo: "%" },
                ]}
                linhas={dados.perdas}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="min-w-[6rem]">Barra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.perdas.map((r) => (
                  <TableRow
                    key={r.motivo}
                    className="cursor-pointer"
                    data-active={motivoAberto === r.motivo || undefined}
                    onClick={() =>
                      setMotivoAberto((m) => (m === r.motivo ? null : r.motivo))
                    }
                  >
                    <TableCell className="font-medium">{r.motivo}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        {r.qtd}
                        <DeltaBadge atual={r.qtd} anterior={r.qtd_ant} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        {formatarMoeda(r.valor)}
                        <DeltaBadge atual={r.valor} anterior={r.valor_ant} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{r.pct}%</TableCell>
                    <TableCell>
                      <Barra valor={r.valor} max={maxPerda} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {motivoAberto ? (
              <section className="space-y-2 rounded-lg border border-border p-3">
                <h3 className="text-sm font-semibold">
                  Negociações — {motivoAberto}
                </h3>
                {perdasDoMotivo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma no período.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {perdasDoMotivo.map((n) => (
                      <li key={n.id} className="text-sm">
                        <Link
                          href={`/negociacoes/${n.id}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {n.empresa_nome} — {n.titulo}
                        </Link>
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatarMoeda(n.valor_estimado)} · {n.responsavel_nome}
                          {n.fechado_em ? ` · ${formatarData(n.fechado_em)}` : ""}
                        </span>
                        {n.anotacao_fechamento ? (
                          <p className="mt-1 text-muted-foreground">
                            {n.anotacao_fechamento}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sem anotação de fechamento.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <p className="text-xs text-muted-foreground">
                Clique em um motivo para ver as negociações e a anotação de
                fechamento.
              </p>
            )}
          </TabsContent>

          {/* ——— Carteira parada ——— */}
          <TabsContent value="carteira" className="mt-4 space-y-6">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    Negociações paradas
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {dados.totais.carteiraQtd} ·{" "}
                    {formatarMoeda(dados.totais.carteiraValor)}
                  </p>
                </div>
                <ExportarCsvButton
                  nome="carteira-parada"
                  colunas={[
                    { chave: "empresa_nome", titulo: "Empresa" },
                    { chave: "titulo", titulo: "Negociação" },
                    { chave: "valor_estimado", titulo: "Valor" },
                    { chave: "responsavel_nome", titulo: "Dono" },
                    { chave: "dias_sem_interacao", titulo: "Dias" },
                  ]}
                  linhas={dados.carteiraParada}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa / Negociação</TableHead>
                    <TableHead>Dono</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.carteiraParada.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <Link
                          href={`/negociacoes/${n.id}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {n.empresa_nome}
                        </Link>
                        <p className="text-xs text-muted-foreground">{n.titulo}</p>
                      </TableCell>
                      <TableCell>{n.responsavel_nome}</TableCell>
                      <TableCell className="text-right">
                        {formatarMoeda(n.valor_estimado)}
                      </TableCell>
                      <TableCell className="text-right">
                        {n.dias_sem_interacao}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {dados.carteiraParada.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma negociação parada.
                </p>
              ) : null}
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold">
                Empresas sem contato
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Dias sem contato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.empresasParadas.map((e) => (
                    <TableRow key={e.empresa_id}>
                      <TableCell>
                        <Link
                          href={`/empresas/${e.empresa_id}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {e.empresa_nome}
                        </Link>
                      </TableCell>
                      <TableCell>{e.responsavel_nome ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {e.dias_sem_contato}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {dados.empresasParadas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma empresa acima do limite.
                </p>
              ) : null}
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </Toaster>
  formatarVariacaoPct,
  mesCurto,
  mesTitulo,
  montarTextoWhatsApp,
  nomeMesAnterior,
  type FunilEtapaBarra,
  type RelatorioPresidencia,
} from "@/lib/relatorio-presidencia";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster, toast } from "@/components/ui/toast";

const ABAS_ENTREGA_2 = [
  "Previsão",
  "Ranking",
  "Perdas",
  "Carteira parada",
] as const;

export function RelatoriosClient({
  relatorio,
  comentarioInicial,
  mesChave,
  ehDiretor,
  funilBarras,
}: {
  relatorio: RelatorioPresidencia;
  comentarioInicial: string;
  /** yyyy-mm */
  mesChave: string;
  ehDiretor: boolean;
  funilBarras: FunilEtapaBarra[];
}) {
  return (
    <Toaster>
      <RelatoriosInner
        relatorio={relatorio}
        comentarioInicial={comentarioInicial}
        mesChave={mesChave}
        ehDiretor={ehDiretor}
        funilBarras={funilBarras}
      />
    </Toaster>
  );
}

function RelatoriosInner({
  relatorio,
  comentarioInicial,
  mesChave,
  ehDiretor,
  funilBarras,
}: {
  relatorio: RelatorioPresidencia;
  comentarioInicial: string;
  mesChave: string;
  ehDiretor: boolean;
  funilBarras: FunilEtapaBarra[];
}) {
  const [comentario, setComentario] = useState(comentarioInicial);
  const [pending, startTransition] = useTransition();
  const [aba, setAba] = useState<"presidencia" | "funil">("presidencia");

  function imprimir() {
    window.print();
  }

  async function copiarTexto() {
    const texto = montarTextoWhatsApp(relatorio, comentario);
    try {
      await navigator.clipboard.writeText(texto);
      toast.add({ type: "success", title: "Copiado" });
    } catch {
      toast.add({
        type: "error",
        title: "Não foi possível copiar",
      });
    }
  }

  function salvarComentario(valor: string) {
    if (!ehDiretor) return;
    startTransition(async () => {
      const res = await salvarComentarioDiretor(mesChave, valor);
      if (res.error) {
        toast.add({ type: "error", title: res.error });
        return;
      }
      toast.add({ type: "success", title: "Comentário salvo" });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={imprimir}>
          Imprimir / PDF
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copiarTexto}>
          Copiar como texto
        </Button>
      </div>

      <Tabs
        value={aba}
        onValueChange={(v) => {
          if (v === "presidencia" || v === "funil") setAba(v);
        }}
        className="gap-4"
      >
        <TabsList className="no-print h-auto min-h-8 w-full max-w-full flex-wrap justify-start">
          <TabsTrigger value="presidencia">Presidência</TabsTrigger>
          <TabsTrigger value="funil">Funil</TabsTrigger>
          {ABAS_ENTREGA_2.map((label) => (
            <TabsTrigger
              key={label}
              value={`soon-${label}`}
              disabled
              title="entrega 2"
            >
              {label}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                entrega 2
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="presidencia" className="mt-0">
          <article
            id="relatorio-presidencia"
            className="relatorio-print mx-auto max-w-3xl space-y-5 text-sm"
          >
            <header className="border-b border-border pb-3">
              <h2 className="text-lg font-semibold tracking-tight">
                F-Led · Vendas e previsão
              </h2>
              <p className="text-muted-foreground">
                {mesTitulo(relatorio.mes)} · até{" "}
                {formatarData(new Date()).slice(0, 5)}
              </p>
            </header>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Resultado do mês</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metrica
                  label="Vendido"
                  valor={formatarMoeda(relatorio.vendido)}
                  detalhe={
                    relatorio.variacao_pct == null
                      ? "— vs. mês anterior"
                      : `${formatarVariacaoPct(relatorio.variacao_pct)} vs. ${nomeMesAnterior(relatorio.mes)}`
                  }
                />
                <Metrica
                  label="Nº vendas"
                  valor={String(relatorio.qtd_vendida)}
                />
                <Metrica
                  label="Ticket médio"
                  valor={formatarMoeda(relatorio.ticket_medio)}
                />
                <Metrica
                  label="Conversão"
                  valor={
                    relatorio.conversao_pct == null
                      ? "—"
                      : `${relatorio.conversao_pct}%`
                  }
                  detalhe={`Perdido ${formatarMoedaCurta(relatorio.perdido)} (${relatorio.qtd_perdida})`}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Previsão</h3>
              {(relatorio.previsao ?? []).length === 0 ? (
                <p className="text-muted-foreground">
                  Sem negociações em aberto
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Mês</th>
                        <th className="px-3 py-2 font-medium">Aberto</th>
                        <th className="px-3 py-2 font-medium">Realista</th>
                        <th className="px-3 py-2 font-medium">Otimista</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(relatorio.previsao ?? []).map((p) => (
                        <tr key={p.mes}>
                          <td className="px-3 py-2">{mesCurto(p.mes)}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatarMoeda(p.aberto)}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatarMoeda(p.realista)}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatarMoeda(p.otimista)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Maiores negociações
              </h3>
              {(relatorio.top_negociacoes ?? []).length === 0 ? (
                <p className="text-muted-foreground">
                  Sem negociações em aberto
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Empresa</th>
                        <th className="px-3 py-2 font-medium">Valor</th>
                        <th className="px-3 py-2 font-medium">Etapa</th>
                        <th className="px-3 py-2 font-medium">Próximo passo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(relatorio.top_negociacoes ?? []).map((n, i) => {
                        const passo = [
                          n.proxima_acao_descricao,
                          n.proxima_acao_data
                            ? formatarData(n.proxima_acao_data)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <tr key={`${n.empresa_nome}-${i}`}>
                            <td className="px-3 py-2">{n.empresa_nome}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {formatarMoeda(n.valor_estimado)}
                            </td>
                            <td className="px-3 py-2">
                              {n.etapa_nome ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {passo || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Perdas do mês</h3>
              {(relatorio.perdas ?? []).length === 0 ? (
                <p className="text-muted-foreground">Nenhuma perda no mês.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {(relatorio.perdas ?? []).map((p, i) => (
                    <li
                      key={`${p.motivo_perda}-${i}`}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <span>{p.motivo_perda ?? "Sem motivo"}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {p.qtd}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="break-inside-avoid">
              <h3 className="mb-2 text-sm font-semibold">
                Comentário do diretor
              </h3>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                onBlur={(e) => {
                  if (e.target.value !== comentarioInicial) {
                    salvarComentario(e.target.value);
                  }
                }}
                readOnly={!ehDiretor}
                disabled={pending}
                placeholder={
                  ehDiretor
                    ? "Observações para o relatório…"
                    : "Sem comentário"
                }
                rows={4}
                className="print:border-0 print:bg-transparent"
              />
            </section>
          </article>
        </TabsContent>

        <TabsContent value="funil" className="no-print mt-0">
          <FunilBarras barras={funilBarras} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metrica({
  label,
  valor,
  detalhe,
}: {
  label: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums tracking-tight">
        {valor}
      </p>
      {detalhe ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{detalhe}</p>
      ) : null}
    </div>
  );
}

function FunilBarras({ barras }: { barras: FunilEtapaBarra[] }) {
  const porFunil = new Map<string, FunilEtapaBarra[]>();
  for (const b of barras) {
    const lista = porFunil.get(b.funilId) ?? [];
    lista.push(b);
    porFunil.set(b.funilId, lista);
  }

  if (porFunil.size === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum funil ativo.</p>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {[...porFunil.entries()].map(([funilId, etapas]) => {
        const maxValor = Math.max(...etapas.map((e) => e.valor), 1);
        const nome = etapas[0]?.funil ?? "Funil";
        return (
          <section key={funilId}>
            <h3 className="mb-3 text-sm font-semibold tracking-tight">
              {nome}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {etapas
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((e) => {
                  const pct = Math.max(2, (e.valor / maxValor) * 100);
                  return (
                    <li key={e.etapaId} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{e.etapa}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {e.qtd} · {formatarMoedaCurta(e.valor)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/80"
                          style={{ width: `${pct}%` }}
                          title={formatarMoeda(e.valor)}
                        />
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
