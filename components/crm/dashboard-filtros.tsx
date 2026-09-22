"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { campoClass } from "@/components/crm/pagina";

import {
  METRICAS_DASHBOARD,
  TIPOS_SEGMENTO,
  VISOES_DATA,
  type FiltrosDashboard,
  type OpcoesDashboard,
} from "@/lib/dashboard/tipos";


function Campo({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      {children}
    </div>
  );
}

export function DashboardFiltros({
  filtros,
  opcoes,
  padrao,
}: {
  filtros: FiltrosDashboard;
  opcoes: OpcoesDashboard;
  padrao: { de: string; ate: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setLista(chave: string, atual: string[], valor: string, marcado: boolean) {
    const prox = marcado
      ? [...new Set([...atual, valor])]
      : atual.filter((v) => v !== valor);
    setParams({ [chave]: prox.length ? prox.join(",") : null });
  }

  function setParams(entries: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(entries)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const temFiltro =
    filtros.de !== padrao.de ||
    filtros.ate !== padrao.ate ||
    filtros.vendedorId ||
    filtros.etapaIds.length > 0 ||
    filtros.visao !== "previsao" ||
    filtros.metrica !== "potencial" ||
    filtros.ufs.length > 0 ||
    filtros.origens.length > 0 ||
    filtros.segmentos.length > 0 ||
    filtros.tipoCliente;

  return (
    <section
      aria-label="Filtros"
      className="card-surface mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-[1.6fr_repeat(8,1fr)]"
    >
      <div className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-3 xl:col-span-1">
        <span className="eyebrow">Período</span>
        <div className="grid grid-cols-2 gap-2">
          <input
            id="dash-de"
            type="date"
            aria-label="Início do período"
            value={filtros.de}
            max={filtros.ate}
            onChange={(e) =>
              setParams({ de: e.target.value === padrao.de ? null : e.target.value })
            }
            className={campoClass}
          />
          <input
            id="dash-ate"
            type="date"
            aria-label="Fim do período"
            value={filtros.ate}
            min={filtros.de}
            onChange={(e) =>
              setParams({
                ate: e.target.value === padrao.ate ? null : e.target.value,
              })
            }
            className={campoClass}
          />
        </div>
      </div>

      {filtros.isDiretor ? (
        <Campo id="dash-vendedor" label="Responsável">
          <select
            id="dash-vendedor"
            value={filtros.vendedorId ?? ""}
            onChange={(e) => setParams({ vendedor: e.target.value || null })}
            className={campoClass}
          >
            <option value="">Todos</option>
            {opcoes.vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </Campo>
      ) : null}

      <MultiCampo
        id="dash-etapa"
        label="Fase / estágio"
        vazio="Todas"
        opcoes={opcoes.etapas.map((et) => ({
          id: et.id,
          label: opcoes.etapas.some(
            (o) => o.nome === et.nome && o.funil !== et.funil,
          )
            ? `${et.nome} (${et.funil})`
            : et.nome,
        }))}
        selecionados={filtros.etapaIds}
        onToggle={(id, marcado) =>
          setLista("etapa", filtros.etapaIds, id, marcado)
        }
      />

      <Campo id="dash-visao" label="Visão data">
        <select
          id="dash-visao"
          value={filtros.visao}
          onChange={(e) =>
            setParams({
              visao: e.target.value === "previsao" ? null : e.target.value,
            })
          }
          className={campoClass}
        >
          {VISOES_DATA.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="dash-metrica" label="Métrica">
        <select
          id="dash-metrica"
          value={filtros.metrica}
          onChange={(e) =>
            setParams({
              metrica: e.target.value === "potencial" ? null : e.target.value,
            })
          }
          className={campoClass}
        >
          {METRICAS_DASHBOARD.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Campo>

      <MultiCampo
        id="dash-uf"
        label="Região (UF)"
        vazio="Todas"
        opcoes={opcoes.ufs.map((uf) => ({ id: uf, label: uf }))}
        selecionados={filtros.ufs}
        onToggle={(id, marcado) => setLista("uf", filtros.ufs, id, marcado)}
      />

      <MultiCampo
        id="dash-origem"
        label="Fonte"
        vazio="Todas"
        opcoes={opcoes.origens.map((o) => ({ id: o, label: o }))}
        selecionados={filtros.origens}
        onToggle={(id, marcado) =>
          setLista("origem", filtros.origens, id, marcado)
        }
      />

      <Campo id="dash-tipo-cliente" label="Tipo de cliente">
        <select
          id="dash-tipo-cliente"
          value={filtros.tipoCliente ?? ""}
          onChange={(e) => setParams({ tipo_cliente: e.target.value || null })}
          className={campoClass}
        >
          <option value="">Todos</option>
          {opcoes.tiposCliente.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Campo>

      <MultiCampo
        id="dash-segmento"
        label="Natureza"
        vazio="Todas"
        opcoes={TIPOS_SEGMENTO.map((t) => ({ id: t.id, label: t.label }))}
        selecionados={filtros.segmentos}
        onToggle={(id, marcado) =>
          setLista("segmento", filtros.segmentos, id, marcado)
        }
      />

      {temFiltro ? (
        <div className="col-span-2 sm:col-span-3 xl:col-span-9">
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      ) : null}
    </section>
  );
}

function MultiCampo({
  id,
  label,
  vazio,
  opcoes,
  selecionados,
  onToggle,
}: {
  id: string;
  label: string;
  vazio: string;
  opcoes: { id: string; label: string }[];
  selecionados: string[];
  onToggle: (id: string, marcado: boolean) => void;
}) {
  const resumo =
    selecionados.length === 0
      ? vazio
      : selecionados.length === 1
        ? (opcoes.find((o) => o.id === selecionados[0])?.label ?? selecionados[0])
        : `${selecionados.length} selecionados`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={id} className="eyebrow">
        {label}
      </span>
      <details className="relative">
        <summary className={`${campoClass} flex cursor-pointer list-none items-center`}>
          {resumo}
        </summary>
        <div className="absolute z-20 mt-1 max-h-56 w-full min-w-[12rem] overflow-auto rounded-lg border border-input bg-card p-2 shadow-md">
          {opcoes.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">Nenhuma opção</p>
          ) : (
            opcoes.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={selecionados.includes(o.id)}
                  onChange={(e) => onToggle(o.id, e.target.checked)}
                />
                {o.label}
              </label>
            ))
          )}
        </div>
      </details>
    </div>
  );
}
