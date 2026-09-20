"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

import type { CartaoNegociacaoData } from "@/components/crm/cartao-negociacao";
import { BotaoExportar } from "@/components/crm/botao-exportar";
import {
  FunilKanban,
  type EtapaColuna,
} from "@/components/crm/funil-kanban";
import { FunilLista, type LinhaLista } from "@/components/crm/funil-lista";
import { MiniFormProximaAcao } from "@/components/crm/mini-form-proxima-acao";
import {
  BarraFiltros,
  CampoFiltro,
  PaginaCabecalho,
  Pilulas,
  Secao,
  campoClass,
} from "@/components/crm/pagina";
import { formatarMoedaCurta } from "@/lib/format";
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
    emitenteNome?: string | null;
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

  const funilAtual = funis.find((f) => f.id === funilId);
  const totalValor = etapas.reduce((s, e) => s + e.valor, 0);
  const totalQtd = etapas.reduce((s, e) => s + e.qtd, 0);
  const temFiltro = Boolean(filtros.vendedor || filtros.linha || filtros.temperatura || filtros.q);

  return (
    <Toaster>
      <div className="flex flex-col gap-4">
        <PaginaCabecalho
          titulo="Funil"
          subtitulo={funilAtual?.nome}
          descricao={
            <>
              <span className="font-semibold text-foreground tabular-nums">{totalQtd}</span>{" "}
              negociações abertas ·{" "}
              <span className="font-semibold text-foreground tabular-nums">{formatarMoedaCurta(totalValor)}</span>
              {filtros.emitenteNome ? ` · ${filtros.emitenteNome}` : " · todas as empresas"}
              {temFiltro ? " · com filtros" : ""}
            </>
          }
          acoes={
            <>
              {filtros.vista === "lista" ? (
                <BotaoExportar
                  tela="funil-lista"
                  filtros={{
                    funil: funilId,
                    vendedor: filtros.vendedor,
                    linha: filtros.linha,
                    temperatura: filtros.temperatura,
                    q: filtros.q || null,
                  }}
                />
              ) : null}
              <Pilulas
                ariaLabel="Visão do funil"
                valor={filtros.vista}
                onChange={(v) => setParam("vista", v === "kanban" ? null : v)}
                opcoes={[
                  { id: "kanban", label: "Kanban", icone: LayoutGrid },
                  { id: "lista", label: "Lista", icone: List },
                ]}
              />
            </>
          }
        />

        <BarraFiltros
          acoes={
            temFiltro ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  for (const k of ["vendedor", "linha", "temperatura", "q"]) params.delete(k);
                  setBuscaLocal("");
                  const qs = params.toString();
                  router.push(qs ? `${pathname}?${qs}` : pathname);
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        >
          <CampoFiltro id="filtro-funil" label="Funil">
            <select
              id="filtro-funil"
              value={funilId}
              onChange={(e) => setParam("funil", e.target.value)}
              className={campoClass}
            >
              {funis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </CampoFiltro>

          {isDiretor ? (
            <SeletorVendedor vendedores={vendedores} valor={filtros.vendedor} />
          ) : null}

          <CampoFiltro id="filtro-linha" label="Linha">
            <select
              id="filtro-linha"
              value={filtros.linha ?? ""}
              onChange={(e) => setParam("linha", e.target.value || null)}
              className={campoClass}
            >
              <option value="">Todas</option>
              {linhasOpcoes.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro id="filtro-temp" label="Temperatura">
            <select
              id="filtro-temp"
              value={filtros.temperatura ?? ""}
              onChange={(e) => setParam("temperatura", e.target.value || null)}
              className={campoClass}
            >
              <option value="">Todas</option>
              <option value="1">1 · Fria</option>
              <option value="2">2 · Morna</option>
              <option value="3">3 · Quente</option>
            </select>
          </CampoFiltro>

          <CampoFiltro id="filtro-busca" label="Busca" className="col-span-2">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setParam("q", buscaLocal.trim() || null);
              }}
            >
              <Input
                id="filtro-busca"
                value={buscaLocal}
                onChange={(e) => setBuscaLocal(e.target.value)}
                placeholder="Título ou empresa"
                className={campoClass}
              />
              <Button type="submit" variant="secondary" size="sm" className="h-9">
                Buscar
              </Button>
            </form>
          </CampoFiltro>
        </BarraFiltros>

        {filtros.vista === "lista" ? (
          <Secao
            titulo="Negociações abertas"
            meta={`${linhas.length} de ${totalQtd}`}
            semPadding
          >
            <FunilLista linhas={linhas} />
          </Secao>
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
