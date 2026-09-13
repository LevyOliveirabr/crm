"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

import type { CartaoNegociacaoData } from "@/components/crm/cartao-negociacao";
import {
  FunilKanban,
  type EtapaColuna,
} from "@/components/crm/funil-kanban";
import { FunilLista, type LinhaLista } from "@/components/crm/funil-lista";
import { MiniFormProximaAcao } from "@/components/crm/mini-form-proxima-acao";
import { SeletorVendedor, type VendedorOption } from "@/components/crm/seletor-vendedor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/toast";

export type FunilOption = {
  id: string;
  nome: string;
  ordem: number;
};

export function FunilClient({
  funis,
  funilId,
  etapas,
  negociacoes,
  linhas,
  linhasOpcoes,
  vendedores,
  isDiretor,
  filtros,
}: {
  funis: FunilOption[];
  funilId: string;
  etapas: EtapaColuna[];
  negociacoes: CartaoNegociacaoData[];
  linhas: LinhaLista[];
  linhasOpcoes: string[];
  vendedores: VendedorOption[];
  isDiretor: boolean;
  filtros: {
    vendedor: string | null;
    linha: string | null;
    temperatura: string | null;
    q: string;
    vista: "kanban" | "lista";
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [miniOpen, setMiniOpen] = useState(false);
  const [negociacaoId, setNegociacaoId] = useState<string | null>(null);
  const [buscaLocal, setBuscaLocal] = useState(filtros.q);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onPrecisaProximaAcao(id: string) {
    setNegociacaoId(id);
    setMiniOpen(true);
  }

  return (
    <Toaster>
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Funil</h1>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={filtros.vista === "kanban" ? "secondary" : "ghost"}
                onClick={() => setParam("vista", "kanban")}
                aria-pressed={filtros.vista === "kanban"}
              >
                <LayoutGrid className="size-4" />
                Kanban
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filtros.vista === "lista" ? "secondary" : "ghost"}
                onClick={() => setParam("vista", "lista")}
                aria-pressed={filtros.vista === "lista"}
              >
                <List className="size-4" />
                Lista
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filtro-funil" className="text-sm font-medium">
                Funil
              </label>
              <select
                id="filtro-funil"
                value={funilId}
                onChange={(e) => setParam("funil", e.target.value)}
                className="h-8 w-full min-w-[10rem] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto"
              >
                {funis.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>

            {isDiretor ? (
              <SeletorVendedor
                vendedores={vendedores}
                valor={filtros.vendedor}
              />
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="filtro-linha" className="text-sm font-medium">
                Linha
              </label>
              <select
                id="filtro-linha"
                value={filtros.linha ?? ""}
                onChange={(e) => setParam("linha", e.target.value || null)}
                className="h-8 w-full min-w-[10rem] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto"
              >
                <option value="">Todas</option>
                {linhasOpcoes.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="filtro-temp" className="text-sm font-medium">
                Temperatura
              </label>
              <select
                id="filtro-temp"
                value={filtros.temperatura ?? ""}
                onChange={(e) =>
                  setParam("temperatura", e.target.value || null)
                }
                className="h-8 w-full min-w-[8rem] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto"
              >
                <option value="">Todas</option>
                <option value="1">1 · Fria</option>
                <option value="2">2 · Morna</option>
                <option value="3">3 · Quente</option>
              </select>
            </div>

            <form
              className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs"
              onSubmit={(e) => {
                e.preventDefault();
                setParam("q", buscaLocal.trim() || null);
              }}
            >
              <label htmlFor="filtro-busca" className="text-sm font-medium">
                Busca
              </label>
              <Input
                id="filtro-busca"
                value={buscaLocal}
                onChange={(e) => setBuscaLocal(e.target.value)}
                placeholder="Título ou empresa"
              />
            </form>
          </div>
        </header>

        {filtros.vista === "lista" ? (
          <FunilLista linhas={linhas} />
        ) : (
          <FunilKanban
            etapas={etapas}
            negociacoes={negociacoes}
            onPrecisaProximaAcao={onPrecisaProximaAcao}
          />
        )}

        <MiniFormProximaAcao
          open={miniOpen}
          onOpenChange={setMiniOpen}
          negociacaoId={negociacaoId}
          onConcluido={() => setNegociacaoId(null)}
        />
      </div>
    </Toaster>
  );
}
