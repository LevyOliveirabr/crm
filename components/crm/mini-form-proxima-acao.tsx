"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { criarAcao } from "@/lib/actions/acoes";
import {
  adicionarDiasISO,
  hojeISO,
  proximaSegundaISO,
} from "@/lib/format";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TipoAcao = Database["public"]["Enums"]["tipo_acao"];

const TIPOS: { value: TipoAcao; label: string }[] = [
  { value: "ligar", label: "Ligar" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "visita", label: "Visita" },
  { value: "reuniao", label: "Reunião" },
  { value: "proposta", label: "Proposta" },
  { value: "outro", label: "Outro" },
];

export type MiniFormProximaAcaoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negociacaoId: string | null;
  /** Chamado após salvar ou pular (útil para limpar estado local). */
  onConcluido?: () => void;
};

export function MiniFormProximaAcao({
  open,
  onOpenChange,
  negociacaoId,
  onConcluido,
}: MiniFormProximaAcaoProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoAcao>("ligar");
  const [data, setData] = useState(() => adicionarDiasISO(hojeISO(), 1));
  const [erro, setErro] = useState<string | null>(null);

  function reset() {
    setDescricao("");
    setTipo("ligar");
    setData(adicionarDiasISO(hojeISO(), 1));
    setErro(null);
  }

  function fechar() {
    onOpenChange(false);
    reset();
    onConcluido?.();
  }

  function atalho(novaData: string) {
    setData(novaData);
  }

  function salvar() {
    if (!negociacaoId) return;
    setErro(null);
    startTransition(async () => {
      const result = await criarAcao({
        negociacao_id: negociacaoId,
        descricao,
        tipo,
        data,
      });
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      fechar();
      router.refresh();
    });
  }

  function pular() {
    fechar();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          fechar();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Próxima ação?</DialogTitle>
          <DialogDescription>
            Defina o próximo passo desta negociação ou pule por agora.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="proxima-acao-desc" className="text-sm font-medium">
              Descrição
            </label>
            <Textarea
              id="proxima-acao-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Ligar para confirmar proposta"
              rows={2}
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="proxima-acao-tipo" className="text-sm font-medium">
              Tipo
            </label>
            <select
              id="proxima-acao-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAcao)}
              disabled={pending}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="proxima-acao-data" className="text-sm font-medium">
              Data
            </label>
            <Input
              id="proxima-acao-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              disabled={pending}
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending}
                onClick={() => atalho(adicionarDiasISO(hojeISO(), 1))}
              >
                Amanhã
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending}
                onClick={() => atalho(adicionarDiasISO(hojeISO(), 3))}
              >
                +3 dias
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending}
                onClick={() => atalho(proximaSegundaISO())}
              >
                Próxima semana
              </Button>
            </div>
          </div>

          {erro ? (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <button
            type="button"
            onClick={pular}
            disabled={pending}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Pular
          </button>
          <Button
            type="button"
            onClick={salvar}
            disabled={pending || !descricao.trim() || !negociacaoId}
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
