"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import {
  atualizarListaItem,
  criarListaItem,
  reordenarListas,
} from "@/lib/actions/config";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster, toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Lista = Database["public"]["Tables"]["listas"]["Row"];
type TipoLista = Database["public"]["Enums"]["tipo_lista"];

const TIPOS: { tipo: TipoLista; label: string }[] = [
  { tipo: "segmento", label: "Segmentos" },
  { tipo: "linha", label: "Linhas" },
  { tipo: "origem", label: "Origens" },
  { tipo: "motivo_perda", label: "Motivos de perda" },
];

function ItemSortable({
  item,
  onChanged,
}: {
  item: Lista;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState(item.valor);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 border-b border-border py-2 last:border-0",
        isDragging && "opacity-60",
        !item.ativo && "opacity-50",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground"
        aria-label="Arrastar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Input
        value={valor}
        disabled={pending}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          if (valor.trim() === item.valor) return;
          startTransition(async () => {
            const res = await atualizarListaItem(item.id, {
              valor: valor.trim(),
            });
            if (!res.ok) toast.add({ title: res.error, type: "error" });
            else onChanged();
          });
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await atualizarListaItem(item.id, { ativo: !item.ativo });
            onChanged();
          });
        }}
      >
        {item.ativo ? "Desativar" : "Ativar"}
      </Button>
    </div>
  );
}

function ListaTipo({
  tipo,
  items,
  onRefresh,
}: {
  tipo: TipoLista;
  items: Lista[];
  onRefresh: () => void;
}) {
  const [lista, setLista] = useState(items);
  const [novo, setNovo] = useState("");
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const ids = useMemo(() => lista.map((i) => i.id), [lista]);

  return (
    <div className="flex flex-col gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event: DragEndEvent) => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;
          const oldIndex = lista.findIndex((e) => e.id === active.id);
          const newIndex = lista.findIndex((e) => e.id === over.id);
          if (oldIndex < 0 || newIndex < 0) return;
          const next = arrayMove(lista, oldIndex, newIndex);
          setLista(next);
          startTransition(async () => {
            const res = await reordenarListas(
              tipo,
              next.map((e) => e.id),
            );
            if (!res.ok) {
              toast.add({ title: res.error, type: "error" });
              setLista(items);
              return;
            }
            onRefresh();
          });
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {lista.map((item) => (
            <ItemSortable key={item.id} item={item} onChanged={onRefresh} />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <Input
          placeholder="Novo valor"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
        />
        <Button
          type="button"
          disabled={pending || !novo.trim()}
          onClick={() => {
            startTransition(async () => {
              const res = await criarListaItem(tipo, novo);
              if (!res.ok) {
                toast.add({ title: res.error, type: "error" });
                return;
              }
              setNovo("");
              onRefresh();
            });
          }}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}

export function ListasConfigClient({
  initial,
}: {
  initial: Record<TipoLista, Lista[]>;
}) {
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const { listarListasPorTipo } = await import("@/lib/actions/config");
      const next = { ...data };
      for (const t of TIPOS) {
        next[t.tipo] = await listarListasPorTipo(t.tipo);
      }
      setData(next);
    });
  };

  return (
    <Toaster>
      <Tabs defaultValue="segmento">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          {TIPOS.map((t) => (
            <TabsTrigger key={t.tipo} value={t.tipo}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TIPOS.map((t) => (
          <TabsContent key={t.tipo} value={t.tipo}>
            <ListaTipo
              key={`${t.tipo}-${data[t.tipo].map((i) => `${i.id}:${i.valor}:${i.ativo}`).join("|")}`}
              tipo={t.tipo}
              items={data[t.tipo]}
              onRefresh={refresh}
            />
            {pending ? (
              <p className="mt-2 text-xs text-muted-foreground">Atualizando…</p>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </Toaster>
  );
}
