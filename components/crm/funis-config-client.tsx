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
  atualizarEtapa,
  atualizarFunil,
  contarNegociacoesAbertasEtapa,
  criarEtapa,
  criarFunil,
  moverNegociacoesEtapa,
  reordenarEtapas,
  type FunilComEtapas,
} from "@/lib/actions/config";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Toaster, toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formularioClass, subPainelClass } from "@/components/crm/pagina";

type Etapa = Database["public"]["Tables"]["etapas"]["Row"];

function EtapaSortable({
  etapa,
  outrasEtapas,
  onChanged,
}: {
  etapa: Etapa;
  outrasEtapas: Etapa[];
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState(etapa.nome);
  const [dica, setDica] = useState(etapa.dica ?? "");
  const [proposta, setProposta] = useState(etapa.conta_como_proposta);
  const [probabilidade, setProbabilidade] = useState(
    etapa.probabilidade == null ? "" : String(etapa.probabilidade),
  );
  const [moverAberto, setMoverAberto] = useState(false);
  const [abertas, setAbertas] = useState(0);
  const [destino, setDestino] = useState(outrasEtapas[0]?.id ?? "");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: etapa.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const salvar = () => {
    startTransition(async () => {
      const prob = probabilidade.trim() === "" ? null : Number(probabilidade);
      const res = await atualizarEtapa(etapa.id, {
        nome,
        dica: dica || null,
        conta_como_proposta: proposta,
        probabilidade: prob != null && Number.isFinite(prob) ? prob : null,
      });
      if (!res.ok) {
        toast.add({ title: res.error, type: "error" });
        return;
      }
      toast.add({ title: "Etapa atualizada", type: "success" });
      onChanged();
    });
  };

  const tentarDesativar = () => {
    startTransition(async () => {
      const n = await contarNegociacoesAbertasEtapa(etapa.id);
      if (n > 0) {
        setAbertas(n);
        setDestino(outrasEtapas[0]?.id ?? "");
        setMoverAberto(true);
        return;
      }
      const res = await atualizarEtapa(etapa.id, { ativo: false });
      if (!res.ok) {
        toast.add({ title: res.error, type: "error" });
        return;
      }
      toast.add({ title: "Etapa desativada", type: "success" });
      onChanged();
    });
  };

  const ativar = () => {
    startTransition(async () => {
      const res = await atualizarEtapa(etapa.id, { ativo: true });
      if (!res.ok) {
        toast.add({ title: res.error, type: "error" });
        return;
      }
      onChanged();
    });
  };

  const confirmarMover = () => {
    if (!destino) return;
    startTransition(async () => {
      const move = await moverNegociacoesEtapa(etapa.id, destino);
      if (!move.ok) {
        toast.add({ title: move.error, type: "error" });
        return;
      }
      const res = await atualizarEtapa(etapa.id, { ativo: false });
      setMoverAberto(false);
      if (!res.ok) {
        toast.add({ title: res.error, type: "error" });
        return;
      }
      toast.add({
        title: "Negociações movidas e etapa desativada",
        type: "success",
      });
      onChanged();
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-2 border-b border-border py-3 last:border-0",
        isDragging && "opacity-60",
        !etapa.ativo && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label="Arrastar etapa"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={salvar}
            disabled={pending}
          />
          <Textarea
            value={dica}
            onChange={(e) => setDica(e.target.value)}
            onBlur={salvar}
            placeholder="Dica: quando mover para cá"
            rows={2}
            disabled={pending}
          />
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Probabilidade de fechar
            </span>
            <span className="inline-flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={probabilidade}
                onChange={(e) => setProbabilidade(e.target.value)}
                onBlur={salvar}
                placeholder="—"
                disabled={pending}
                className="h-8 w-20 tabular-nums"
                aria-label="Probabilidade de fechamento nesta etapa (%)"
              />
              %
            </span>
            <span className="text-xs text-muted-foreground">
              vazio = usa só a temperatura
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={proposta}
              onChange={(e) => {
                setProposta(e.target.checked);
                startTransition(async () => {
                  await atualizarEtapa(etapa.id, {
                    conta_como_proposta: e.target.checked,
                  });
                  onChanged();
                });
              }}
            />
            Conta como proposta
          </label>
        </div>
        <div className="flex flex-col gap-1">
          {etapa.ativo ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={tentarDesativar}
            >
              Desativar
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={ativar}
            >
              Ativar
            </Button>
          )}
        </div>
      </div>

      <Dialog open={moverAberto} onOpenChange={setMoverAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover negociações</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Há <strong>{abertas}</strong> negociação(ões) aberta(s) nesta etapa.
            Escolha para onde movê-las antes de desativar.
          </p>
          <select
            className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
          >
            {outrasEtapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMoverAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={pending || !destino}
              onClick={confirmarMover}
            >
              Mover para…
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FunilBloco({
  funil,
  onChanged,
}: {
  funil: FunilComEtapas;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [etapas, setEtapas] = useState(funil.etapas);
  const [novaEtapa, setNovaEtapa] = useState("");
  const [nomeFunil, setNomeFunil] = useState(funil.nome);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const ids = useMemo(() => etapas.map((e) => e.id), [etapas]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = etapas.findIndex((e) => e.id === active.id);
    const newIndex = etapas.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(etapas, oldIndex, newIndex);
    setEtapas(next);
    startTransition(async () => {
      const res = await reordenarEtapas(
        funil.id,
        next.map((e) => e.id),
      );
      if (!res.ok) {
        toast.add({ title: res.error, type: "error" });
        setEtapas(funil.etapas);
        return;
      }
      onChanged();
    });
  };

  return (
    <section className={subPainelClass}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs font-medium"
          value={nomeFunil}
          onChange={(e) => setNomeFunil(e.target.value)}
          onBlur={() => {
            if (nomeFunil.trim() === funil.nome) return;
            startTransition(async () => {
              const res = await atualizarFunil(funil.id, {
                nome: nomeFunil.trim(),
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
              await atualizarFunil(funil.id, { ativo: !funil.ativo });
              onChanged();
            });
          }}
        >
          {funil.ativo ? "Desativar funil" : "Ativar funil"}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {etapas.map((etapa) => (
            <EtapaSortable
              key={etapa.id}
              etapa={etapa}
              outrasEtapas={etapas.filter((e) => e.id !== etapa.id && e.ativo)}
              onChanged={onChanged}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex gap-2">
        <Input
          placeholder="Nome da nova etapa"
          value={novaEtapa}
          onChange={(e) => setNovaEtapa(e.target.value)}
        />
        <Button
          type="button"
          disabled={pending || !novaEtapa.trim()}
          onClick={() => {
            startTransition(async () => {
              const res = await criarEtapa(funil.id, novaEtapa);
              if (!res.ok) {
                toast.add({ title: res.error, type: "error" });
                return;
              }
              setNovaEtapa("");
              onChanged();
            });
          }}
        >
          + Etapa
        </Button>
      </div>
    </section>
  );
}

export function FunisConfigClient({ initial }: { initial: FunilComEtapas[] }) {
  const [funis, setFunis] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [novoFunil, setNovoFunil] = useState("");

  const refresh = () => {
    startTransition(async () => {
      const { listarFunisComEtapas } = await import("@/lib/actions/config");
      const data = await listarFunisComEtapas();
      setFunis(data);
    });
  };

  return (
    <Toaster>
      <div className="flex flex-col gap-6">
        {funis.map((funil) => (
          <FunilBloco
            key={`${funil.id}-${funil.etapas.map((e) => e.id).join(",")}`}
            funil={funil}
            onChanged={refresh}
          />
        ))}

        <div className={cn(formularioClass, "flex gap-2")}>
          <Input
            placeholder="Nome do novo funil"
            value={novoFunil}
            onChange={(e) => setNovoFunil(e.target.value)}
          />
          <Button
            type="button"
            disabled={pending || !novoFunil.trim()}
            onClick={() => {
              startTransition(async () => {
                const res = await criarFunil(novoFunil);
                if (!res.ok) {
                  toast.add({ title: res.error, type: "error" });
                  return;
                }
                setNovoFunil("");
                refresh();
              });
            }}
          >
            + Funil
          </Button>
        </div>
      </div>
    </Toaster>
  );
}
