"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, MoreVertical } from "lucide-react";

import { registrarInteracao } from "@/lib/actions/interacoes";
import { moverEtapa } from "@/lib/actions/negociacoes";
import { formatarData, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";

export type CartaoNegociacaoData = {
  id: string;
  titulo: string;
  empresaNome: string;
  valorEstimado: number;
  temperatura: number;
  diasNaEtapa: number;
  proximaAcaoDescricao: string | null;
  proximaAcaoData: string | null;
  acaoAtrasada: boolean;
  semAcao: boolean;
  parada: boolean;
  etapaId: string;
  responsavelNome: string | null;
  /** Empresa vendedora (só quando o escopo é "Todas"). */
  emitenteNome?: string | null;
};

export type EtapaOpcao = {
  id: string;
  nome: string;
};

const INTERACAO_LABEL: Record<"ligacao" | "whatsapp" | "visita", string> = {
  ligacao: "Ligação registrada",
  whatsapp: "WhatsApp registrado",
  visita: "Visita registrada",
};

export function CartaoNegociacao({
  negociacao,
  etapas,
  onPrecisaProximaAcao,
  dragHandleProps,
  isDragging,
}: {
  negociacao: CartaoNegociacaoData;
  etapas: EtapaOpcao[];
  onPrecisaProximaAcao: (negociacaoId: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onInteracao(tipo: "ligacao" | "whatsapp" | "visita") {
    startTransition(async () => {
      const result = await registrarInteracao(negociacao.id, tipo);
      if (!result.ok) {
        toast.add({
          type: "error",
          title: "Erro ao registrar",
          description: result.error,
        });
        return;
      }
      toast.add({
        type: "success",
        title: INTERACAO_LABEL[tipo],
      });
      router.refresh();
    });
  }

  function onMover(etapaId: string) {
    if (etapaId === negociacao.etapaId) return;
    startTransition(async () => {
      const result = await moverEtapa(negociacao.id, etapaId);
      if (!result.ok) {
        toast.add({
          type: "error",
          title: "Erro ao mover",
          description: result.error,
        });
        return;
      }
      if (result.precisaProximaAcao && result.negociacaoId) {
        onPrecisaProximaAcao(result.negociacaoId);
      }
      router.refresh();
    });
  }

  const temp = Math.min(3, Math.max(1, negociacao.temperatura || 1));

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-2.5 shadow-xs",
        isDragging && "opacity-90 shadow-md ring-2 ring-ring/40",
        pending && "opacity-70",
      )}
      {...dragHandleProps}
    >
      <div className="flex items-start gap-1">
        <Link
          href={`/negociacoes/${negociacao.id}`}
          className="min-w-0 flex-1"
          onClick={(e) => {
            // evita navegar ao arrastar
            if (pending) e.preventDefault();
          }}
        >
          <p className="truncate text-sm font-medium leading-snug hover:underline">
            {negociacao.titulo}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {negociacao.empresaNome}
            {negociacao.emitenteNome ? ` · ${negociacao.emitenteNome}` : ""}
          </p>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden",
              pending && "pointer-events-none opacity-50",
            )}
            aria-label="Mover para"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuLabel>Mover para…</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {etapas.map((et) => (
              <DropdownMenuItem
                key={et.id}
                disabled={et.id === negociacao.etapaId || pending}
                onClick={() => onMover(et.id)}
              >
                {et.nome}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-medium tabular-nums">
          {formatarMoeda(negociacao.valorEstimado)}
        </span>
        <span
          className="inline-flex items-center gap-0.5 text-brand-foreground"
          title={`Temperatura ${temp}`}
          aria-label={`Temperatura ${temp}`}
        >
          {Array.from({ length: temp }, (_, i) => (
            <Flame key={i} className="size-3 fill-current" aria-hidden />
          ))}
        </span>
        <span className="text-muted-foreground">{negociacao.diasNaEtapa} d</span>
      </div>

      {(negociacao.acaoAtrasada ||
        negociacao.semAcao ||
        negociacao.parada) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {negociacao.acaoAtrasada ? (
            <Badge variant="destructive">Atrasada</Badge>
          ) : null}
          {negociacao.semAcao ? (
            <Badge variant="warning">Sem ação</Badge>
          ) : null}
          {negociacao.parada ? (
            <Badge variant="secondary" className="text-muted-foreground">
              Parada
            </Badge>
          ) : null}
        </div>
      )}

      {negociacao.proximaAcaoDescricao || negociacao.proximaAcaoData ? (
        <p
          className={cn(
            "mt-1.5 line-clamp-2 text-xs",
            negociacao.acaoAtrasada
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {negociacao.proximaAcaoDescricao ?? "Próxima ação"}
          {negociacao.proximaAcaoData
            ? ` · ${formatarData(negociacao.proximaAcaoData)}`
            : null}
        </p>
      ) : null}

      <div className="mt-2 flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onInteracao("ligacao");
          }}
        >
          Liguei
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onInteracao("whatsapp");
          }}
        >
          WhatsApp
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onInteracao("visita");
          }}
        >
          Visitei
        </Button>
      </div>
    </div>
  );
}
