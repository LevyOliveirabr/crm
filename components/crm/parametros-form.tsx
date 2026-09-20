"use client";

import { useState, useTransition } from "react";

import { salvarParametros } from "@/lib/actions/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "@/components/ui/toast";

export function ParametrosForm({
  initial,
}: {
  initial: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [valores, setValores] = useState({
    dias_parada_negociacao: initial.dias_parada_negociacao ?? "30",
    dias_parada_empresa: initial.dias_parada_empresa ?? "60",
    peso_fria: initial.peso_fria ?? "0.2",
    peso_morna: initial.peso_morna ?? "0.5",
    peso_quente: initial.peso_quente ?? "0.8",
    alerta_validade_orcamento_dias:
      initial.alerta_validade_orcamento_dias ?? "3",
  });

  const set = (chave: keyof typeof valores, valor: string) =>
    setValores((v) => ({ ...v, [chave]: valor }));

  return (
    <Toaster>
      <form
        className="flex max-w-lg flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await salvarParametros(valores);
            if (!res.ok) {
              toast.add({ title: res.error, type: "error" });
              return;
            }
            toast.add({ title: "Parâmetros salvos", type: "success" });
          });
        }}
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Dias de parada</legend>
          <label className="block text-sm">
            Negociação
            <Input
              type="number"
              min={1}
              className="mt-1"
              value={valores.dias_parada_negociacao}
              onChange={(e) => set("dias_parada_negociacao", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Empresa
            <Input
              type="number"
              min={1}
              className="mt-1"
              value={valores.dias_parada_empresa}
              onChange={(e) => set("dias_parada_empresa", e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Pesos da previsão</legend>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["peso_fria", "Fria"],
                ["peso_morna", "Morna"],
                ["peso_quente", "Quente"],
              ] as const
            ).map(([chave, label]) => (
              <label key={chave} className="block text-sm">
                {label}
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={1}
                  className="mt-1"
                  value={valores[chave]}
                  onChange={(e) => set(chave, e.target.value)}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          Dias de alerta de validade do orçamento
          <Input
            type="number"
            min={0}
            className="mt-1"
            value={valores.alerta_validade_orcamento_dias}
            onChange={(e) =>
              set("alerta_validade_orcamento_dias", e.target.value)
            }
          />
        </label>

        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </Toaster>
  );
}
