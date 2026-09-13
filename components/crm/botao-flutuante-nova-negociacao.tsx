"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type { DadosFormNegociacao } from "@/lib/actions/form-negociacao";
import { NovaNegociacaoForm } from "@/components/crm/nova-negociacao-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BotaoFlutuanteNovaNegociacao({
  dados,
}: {
  dados: DadosFormNegociacao;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-20 z-30 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 lg:right-8 lg:bottom-8"
        aria-label="Nova negociação"
      >
        <Plus className="size-6" />
        <span className="sr-only">+ Negociação</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova negociação</DialogTitle>
          </DialogHeader>
          <NovaNegociacaoForm
            dados={dados}
            onCancelar={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
