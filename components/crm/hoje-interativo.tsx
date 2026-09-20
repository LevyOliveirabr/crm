"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Phone,
  MapPin,
  Users,
} from "lucide-react";

import { adiarAcao, concluirAcao } from "@/lib/actions/acoes";
import { formatarData } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import { MiniFormProximaAcao } from "@/components/crm/mini-form-proxima-acao";
import { Contador, EstadoVazio, Secao } from "@/components/crm/pagina";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TipoAcao = Database["public"]["Enums"]["tipo_acao"];

export type AcaoHojeItem = {
  id: string;
  descricao: string;
  tipo: TipoAcao;
  data: string;
  negociacaoId: string;
  empresaNome: string;
  atrasada: boolean;
};

export type NegociacaoSemAcaoItem = {
  id: string;
  titulo: string;
  empresaNome: string;
};

const TIPO_ICONE: Record<
  TipoAcao,
  React.ComponentType<{ className?: string }>
> = {
  ligar: Phone,
  whatsapp: MessageCircle,
  visita: MapPin,
  reuniao: Users,
  proposta: FileText,
  outro: MoreHorizontal,
};

const TIPO_LABEL: Record<TipoAcao, string> = {
  ligar: "Ligar",
  whatsapp: "WhatsApp",
  visita: "Visita",
  reuniao: "Reunião",
  proposta: "Proposta",
  outro: "Outro",
};

export function HojeInterativo({
  atrasadas,
  deHoje,
  semAcao,
}: {
  atrasadas: AcaoHojeItem[];
  deHoje: AcaoHojeItem[];
  semAcao: NegociacaoSemAcaoItem[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [miniOpen, setMiniOpen] = useState(false);
  const [negociacaoId, setNegociacaoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function abrirMini(id: string) {
    setNegociacaoId(id);
    setMiniOpen(true);
  }

  function onConcluir(acaoId: string) {
    setErro(null);
    setPendingId(acaoId);
    startTransition(async () => {
      const result = await concluirAcao(acaoId);
      setPendingId(null);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      if (result.precisaProximaAcao && result.negociacaoId) {
        abrirMini(result.negociacaoId);
      }
      router.refresh();
    });
  }

  function onAdiar(acaoId: string) {
    setErro(null);
    setPendingId(acaoId);
    startTransition(async () => {
      const result = await adiarAcao(acaoId, 1);
      setPendingId(null);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {erro ? (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : null}

        <SecaoAcoes
          titulo="Ações atrasadas"
          vazia="Nenhuma ação atrasada. Bom trabalho."
          itens={atrasadas}
          pending={pending}
          pendingId={pendingId}
          onConcluir={onConcluir}
          onAdiar={onAdiar}
          destaqueAtraso
        />

        <SecaoAcoes
          titulo="Para hoje"
          vazia="Nenhuma ação agendada para hoje."
          itens={deHoje}
          pending={pending}
          pendingId={pendingId}
          onConcluir={onConcluir}
          onAdiar={onAdiar}
        />
      </div>

      <Secao
        titulo="Sem próxima ação"
        meta={semAcao.length > 0 ? <Contador valor={semAcao.length} tom="alerta" /> : undefined}
        className="lg:col-start-2 lg:row-start-1"
      >
        {semAcao.length === 0 ? (
          <EstadoVazio texto="Toda negociação aberta tem um próximo passo." compacto />
        ) : (
          <ul className="divide-y divide-border">
            {semAcao.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/negociacoes/${n.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {n.titulo}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {n.empresaNome}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => abrirMini(n.id)}
                >
                  Definir ação
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <MiniFormProximaAcao
        open={miniOpen}
        onOpenChange={setMiniOpen}
        negociacaoId={negociacaoId}
        onConcluido={() => setNegociacaoId(null)}
      />
    </>
  );
}

function SecaoAcoes({
  titulo,
  vazia,
  itens,
  pending,
  pendingId,
  onConcluir,
  onAdiar,
  destaqueAtraso = false,
}: {
  titulo: string;
  vazia: string;
  itens: AcaoHojeItem[];
  pending: boolean;
  pendingId: string | null;
  onConcluir: (id: string) => void;
  onAdiar: (id: string) => void;
  destaqueAtraso?: boolean;
}) {
  return (
    <Secao
      titulo={titulo}
      meta={
        itens.length > 0 ? (
          <Contador valor={itens.length} tom={destaqueAtraso ? "ruim" : undefined} />
        ) : undefined
      }
    >
      {itens.length === 0 ? (
        <EstadoVazio texto={vazia} compacto />
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((acao) => {
            const Icon = TIPO_ICONE[acao.tipo] ?? CalendarClock;
            const busy = pending && pendingId === acao.id;
            return (
              <li
                key={acao.id}
                className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
                      acao.atrasada && "bg-danger-bg text-destructive",
                    )}
                    title={TIPO_LABEL[acao.tipo]}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {acao.descricao}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {acao.empresaNome}
                      <span className="mx-1 opacity-50">·</span>
                      {TIPO_LABEL[acao.tipo]}
                      <span className="mx-1 opacity-50">·</span>
                      <span
                        className={cn(
                          acao.atrasada && "font-medium text-destructive",
                        )}
                      >
                        {formatarData(acao.data)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5 self-end sm:self-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onAdiar(acao.id)}
                  >
                    Adiar 1 dia
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => onConcluir(acao.id)}
                  >
                    {busy ? "…" : "Concluir"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}
