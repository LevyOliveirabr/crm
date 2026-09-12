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
      {erro ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <SecaoAcoes
        titulo="Atrasadas"
        vazia="Nenhuma ação atrasada."
        itens={atrasadas}
        pending={pending}
        pendingId={pendingId}
        onConcluir={onConcluir}
        onAdiar={onAdiar}
        destaqueAtraso
      />

      <SecaoAcoes
        titulo="Hoje"
        vazia="Nenhuma ação para hoje."
        itens={deHoje}
        pending={pending}
        pendingId={pendingId}
        onConcluir={onConcluir}
        onAdiar={onAdiar}
      />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold tracking-tight text-foreground">
          Sem próxima ação
        </h2>
        {semAcao.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma negociação sem ação.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {semAcao.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
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
      </section>

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
    <section className="mt-6">
      <h2
        className={cn(
          "mb-2 text-sm font-semibold tracking-tight",
          destaqueAtraso && itens.length > 0
            ? "text-destructive"
            : "text-foreground",
        )}
      >
        {titulo}
        {itens.length > 0 ? (
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({itens.length})
          </span>
        ) : null}
      </h2>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazia}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {itens.map((acao) => {
            const Icon = TIPO_ICONE[acao.tipo] ?? CalendarClock;
            const busy = pending && pendingId === acao.id;
            return (
              <li
                key={acao.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted",
                      acao.atrasada && "bg-destructive/10 text-destructive",
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
    </section>
  );
}
