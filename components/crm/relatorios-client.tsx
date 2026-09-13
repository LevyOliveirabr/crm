"use client";

import { useState, useTransition } from "react";

import { salvarComentarioDiretor } from "@/lib/actions/config";
import {
  formatarData,
  formatarMoeda,
  formatarMoedaCurta,
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
