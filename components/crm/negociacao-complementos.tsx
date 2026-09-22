"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  clonarNegociacao,
  excluirParcela,
  marcarFaturado,
  salvarParcela,
} from "@/lib/actions/negociacoes";
import { formatarMoeda, hojeISO, parseMoedaBR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ParcelaFicha = {
  id: string;
  mes: string;
  valor: number;
};

export function NegociacaoComplementos({
  negociacaoId,
  status,
  valorFinal,
  faturado,
  valorFaturado,
  faturadoEm,
  parcelas,
}: {
  negociacaoId: string;
  status: "aberta" | "vendida" | "perdida";
  valorFinal: number | null;
  faturado: boolean;
  valorFaturado: number | null;
  faturadoEm: string | null;
  parcelas: ParcelaFicha[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [valorFat, setValorFat] = useState(
    valorFaturado != null
      ? String(valorFaturado)
      : valorFinal != null
        ? String(valorFinal)
        : "",
  );
  const [dataFat, setDataFat] = useState(faturadoEm ?? hojeISO());
  const [mesParc, setMesParc] = useState(hojeISO().slice(0, 7));
  const [valorParc, setValorParc] = useState("");

  function renovar() {
    setErro(null);
    startTransition(async () => {
      const res = await clonarNegociacao(negociacaoId);
      if (res && !res.ok) setErro(res.error);
    });
  }

  function faturar() {
    const valor = parseMoedaBR(valorFat) ?? Number(valorFat.replace(",", "."));
    if (valor == null || Number.isNaN(valor)) {
      setErro("Valor faturado inválido.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await marcarFaturado(negociacaoId, valor, dataFat);
      if (!res.ok) setErro(res.error);
      else router.refresh();
    });
  }

  function addParcela() {
    const valor = parseMoedaBR(valorParc) ?? Number(valorParc.replace(",", "."));
    if (valor == null || Number.isNaN(valor)) {
      setErro("Valor da previsão inválido.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await salvarParcela({
        negociacaoId,
        mes: mesParc,
        valor,
      });
      if (!res.ok) setErro(res.error);
      else {
        setValorParc("");
        router.refresh();
      }
    });
  }

  return (
    <div className="col-span-2 flex flex-col gap-3 rounded-xl border border-border p-3">
      {status === "vendida" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {faturado
              ? `Faturado: ${formatarMoeda(valorFaturado ?? 0)}${faturadoEm ? ` em ${faturadoEm.split("-").reverse().join("/")}` : ""}`
              : "Ainda não faturado"}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Valor faturado
              <Input
                value={valorFat}
                onChange={(e) => setValorFat(e.target.value)}
                className="h-8 w-36"
                inputMode="decimal"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Data
              <Input
                type="date"
                value={dataFat}
                onChange={(e) => setDataFat(e.target.value)}
                className="h-8"
              />
            </label>
            <Button type="button" size="sm" disabled={pending} onClick={faturar}>
              {faturado ? "Atualizar faturamento" : "Marcar como faturado"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Previsões no tempo</p>
        {parcelas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sem parcelas. A previsão da ficha vale para um mês só.
          </p>
        ) : (
          <ul className="text-sm">
            {parcelas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                <span>
                  {p.mes.slice(5, 7)}/{p.mes.slice(0, 4)} · {formatarMoeda(p.valor)}
                </span>
                <button
                  type="button"
                  className="text-xs text-destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await excluirParcela(negociacaoId, p.id);
                      if (!res.ok) setErro(res.error);
                      else router.refresh();
                    })
                  }
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Mês
            <Input
              type="month"
              value={mesParc}
              onChange={(e) => setMesParc(e.target.value)}
              className="h-8"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Valor
            <Input
              value={valorParc}
              onChange={(e) => setValorParc(e.target.value)}
              className="h-8 w-32"
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={addParcela}>
            Adicionar previsão
          </Button>
        </div>
      </div>

      <div>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={renovar}>
          Renovar (criar cópia ligada a esta)
        </Button>
      </div>
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
    </div>
  );
}
