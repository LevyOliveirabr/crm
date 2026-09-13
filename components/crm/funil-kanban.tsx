"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { moverEtapa } from "@/lib/actions/negociacoes";
import { formatarMoedaCurta } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CartaoNegociacao,
  type CartaoNegociacaoData,
  type EtapaOpcao,
} from "@/components/crm/cartao-negociacao";
import { toast } from "@/components/ui/toast";

export type EtapaColuna = EtapaOpcao & {
  ordem: number;
  qtd: number;
  valor: number;
};

function useDesktopDrag() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return enabled;
}

function CartaoDraggable({
  negociacao,
  etapas,
  onPrecisaProximaAcao,
  dragEnabled,
}: {
  negociacao: CartaoNegociacaoData;
  etapas: EtapaOpcao[];
  onPrecisaProximaAcao: (id: string) => void;
  dragEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: negociacao.id,
      data: { negociacao },
      disabled: !dragEnabled,
    });

  const style: React.CSSProperties | undefined = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-20 opacity-50")}
    >
      <CartaoNegociacao
        negociacao={negociacao}
        etapas={etapas}
        onPrecisaProximaAcao={onPrecisaProximaAcao}
        isDragging={isDragging}
        dragHandleProps={dragEnabled ? { ...listeners, ...attributes } : undefined}
      />
    </div>
  );
}

function Coluna({
  etapa,
  cards,
  etapas,
  onPrecisaProximaAcao,
  dragEnabled,
}: {
  etapa: EtapaColuna;
  cards: CartaoNegociacaoData[];
  etapas: EtapaOpcao[];
  onPrecisaProximaAcao: (id: string) => void;
  dragEnabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[min(85vw,18rem)] shrink-0 flex-col rounded-xl border border-border bg-muted/30 lg:w-72",
        isOver && "border-ring bg-muted/50",
      )}
      aria-label={`Etapa ${etapa.nome}`}
    >
      <header className="sticky top-0 z-10 border-b border-border bg-muted/80 px-3 py-2 backdrop-blur">
        <h2 className="truncate text-sm font-semibold">{etapa.nome}</h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {etapa.qtd} · {formatarMoedaCurta(etapa.valor)}
        </p>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {cards.map((n) => (
          <CartaoDraggable
            key={n.id}
            negociacao={n}
            etapas={etapas}
            onPrecisaProximaAcao={onPrecisaProximaAcao}
            dragEnabled={dragEnabled}
          />
        ))}
        {cards.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Vazia
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function FunilKanban({
  etapas,
  negociacoes,
  onPrecisaProximaAcao,
}: {
  etapas: EtapaColuna[];
  negociacoes: CartaoNegociacaoData[];
  onPrecisaProximaAcao: (negociacaoId: string) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragEnabled = useDesktopDrag();

  const sensores = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const porEtapa = useMemo(() => {
    const map = new Map<string, CartaoNegociacaoData[]>();
    for (const et of etapas) map.set(et.id, []);
    for (const n of negociacoes) {
      const lista = map.get(n.etapaId);
      if (lista) lista.push(n);
    }
    return map;
  }, [etapas, negociacoes]);

  const etapasOpcoes: EtapaOpcao[] = etapas.map(({ id, nome }) => ({
    id,
    nome,
  }));

  const activeCard = activeId
    ? (negociacoes.find((n) => n.id === activeId) ?? null)
    : null;

  function onDragStart(event: DragStartEvent) {
    if (!dragEnabled) return;
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!dragEnabled) return;

    const { active, over } = event;
    if (!over) return;

    const negociacaoId = String(active.id);
    const overId = String(over.id);

    let etapaDestino = etapas.find((e) => e.id === overId)?.id;
    if (!etapaDestino) {
      const cardAlvo = negociacoes.find((n) => n.id === overId);
      etapaDestino = cardAlvo?.etapaId;
    }
    if (!etapaDestino) return;

    const card = negociacoes.find((n) => n.id === negociacaoId);
    if (!card || card.etapaId === etapaDestino) return;

    startTransition(async () => {
      const result = await moverEtapa(negociacaoId, etapaDestino);
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

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
        {etapas.map((etapa) => (
          <Coluna
            key={etapa.id}
            etapa={etapa}
            cards={porEtapa.get(etapa.id) ?? []}
            etapas={etapasOpcoes}
            onPrecisaProximaAcao={onPrecisaProximaAcao}
            dragEnabled={dragEnabled}
          />
        ))}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="w-72">
            <CartaoNegociacao
              negociacao={activeCard}
              etapas={etapasOpcoes}
              onPrecisaProximaAcao={onPrecisaProximaAcao}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
