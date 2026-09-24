"use client";

import { useState } from "react";
import { Info, Plus, X } from "lucide-react";

import type { DadosFormNegociacao } from "@/lib/actions/form-negociacao";
import { NovaNegociacaoForm } from "@/components/crm/nova-negociacao-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DashboardCabecalho({
  titulo,
  subtitulo,
  descricao,
  pesos,
  diasRisco,
  dadosNova,
}: {
  titulo: string;
  subtitulo: string;
  descricao: string;
  pesos: { fria: number; morna: number; quente: number };
  diasRisco: number;
  dadosNova: DadosFormNegociacao | null;
}) {
  const [memorialAberto, setMemorialAberto] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {titulo}{" "}
            <span className="font-medium text-muted-foreground">
              · {subtitulo}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-full border-foreground/80 bg-card px-4 font-semibold"
            aria-expanded={memorialAberto}
            aria-controls="memorial-calculo"
            onClick={() => setMemorialAberto((v) => !v)}
          >
            <Info className="size-4" />
            Memorial de cálculo
          </Button>
          {dadosNova ? (
            <Button
              type="button"
              size="lg"
              className="rounded-full px-4 font-semibold"
              onClick={() => setNovaAberta(true)}
            >
              <Plus className="size-4" />
              Nova oportunidade
            </Button>
          ) : null}
        </div>
      </header>

      {memorialAberto ? (
        <section
          id="memorial-calculo"
          aria-label="Memorial de cálculo"
          className="card-surface relative mb-4 border-l-4 border-l-brand p-4 sm:p-5"
        >
          <button
            type="button"
            onClick={() => setMemorialAberto(false)}
            className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar memorial"
          >
            <X className="size-4" />
          </button>
          <h2 className="mb-3 text-base font-semibold">
            Como os números são calculados
          </h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="font-semibold">Pipeline total</dt>
            <dd className="text-muted-foreground">
              Soma do valor estimado de todas as negociações abertas dentro dos
              filtros.
            </dd>
            <dt className="font-semibold">Pipeline ponderado</dt>
            <dd className="text-muted-foreground">
              Valor estimado × probabilidade da etapa (Configurações › Funis).
              Etapa sem probabilidade usa o peso da temperatura (fria{" "}
              {pct(pesos.fria)}, morna {pct(pesos.morna)}, quente{" "}
              {pct(pesos.quente)}), editável em Configurações › Parâmetros.
            </dd>
            <dt className="font-semibold">Meta do mês</dt>
            <dd className="text-muted-foreground">
              Vendido no mês (valor final das vendas fechadas) ÷ soma das metas
              do mês (Configurações › Metas) dos vendedores dentro do filtro.
            </dd>
            <dt className="font-semibold">Categorias de forecast</dt>
            <dd className="text-muted-foreground">
              Soma do valor estimado das abertas por categoria definida na
              ficha: compromisso (vai fechar), provável, possível.
            </dd>
            <dt className="font-semibold">Win rate</dt>
            <dd className="text-muted-foreground">
              Negociações vendidas ÷ (vendidas + perdidas) fechadas no período
              selecionado. A variação compara com o período anterior de mesma
              duração.
            </dd>
            <dt className="font-semibold">Forecast</dt>
            <dd className="text-muted-foreground">
              Pipeline ponderado das negociações abertas com previsão de
              fechamento no mês ou trimestre indicado. Negociação sem previsão
              conta como o próximo mês.
            </dd>
            <dt className="font-semibold">Pipeline por trimestre</dt>
            <dd className="text-muted-foreground">
              Valor estimado das abertas agrupado pelo trimestre da data
              escolhida em &quot;Visão data&quot;. Na visão &quot;Fechamento
              real&quot; mostra o valor final das vendas por trimestre de
              fechamento.
            </dd>
            <dt className="font-semibold">Alta probabilidade</dt>
            <dd className="text-muted-foreground">
              Temperatura quente ou categoria &quot;compromisso&quot;, com data
              de fechamento prevista nos próximos 30 dias (ou o mês previsto,
              quando não há data).
            </dd>
            <dt className="font-semibold">Em risco</dt>
            <dd className="text-muted-foreground">
              Aberta sem próxima ação, com ação atrasada ou sem interação há
              mais de {diasRisco} dias (chave{" "}
              <code className="font-mono text-xs">dias_risco_dashboard</code>{" "}
              em config).
            </dd>
          </dl>
        </section>
      ) : null}

      {dadosNova ? (
        <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
          <DialogContent className="max-h-[min(90dvh,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-lg min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova oportunidade</DialogTitle>
            </DialogHeader>
            <NovaNegociacaoForm
              dados={dadosNova}
              onCancelar={() => setNovaAberta(false)}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
