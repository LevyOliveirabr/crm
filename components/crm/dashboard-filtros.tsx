"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { campoClass } from "@/components/crm/pagina";

import {
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
    filtros.etapaId ||
    filtros.visao !== "previsao" ||
    filtros.uf ||
    filtros.origem ||
    filtros.segmento;

  return (
    <section
      aria-label="Filtros"
      className="card-surface mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-[1.6fr_repeat(6,1fr)]"
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

      <Campo id="dash-etapa" label="Fase / estágio">
        <select
          id="dash-etapa"
          value={filtros.etapaId ?? ""}
          onChange={(e) => setParams({ etapa: e.target.value || null })}
          className={campoClass}
        >
          <option value="">Todas</option>
          {opcoes.etapas.map((et) => (
            <option key={et.id} value={et.id}>
              {et.nome}
              {opcoes.etapas.some(
                (o) => o.nome === et.nome && o.funil !== et.funil,
              )
                ? ` (${et.funil})`
                : ""}
            </option>
          ))}
        </select>
      </Campo>

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

      <Campo id="dash-uf" label="Região (UF)">
        <select
          id="dash-uf"
          value={filtros.uf ?? ""}
          onChange={(e) => setParams({ uf: e.target.value || null })}
          className={campoClass}
        >
          <option value="">Todas</option>
          {opcoes.ufs.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="dash-origem" label="Fonte">
        <select
          id="dash-origem"
          value={filtros.origem ?? ""}
          onChange={(e) => setParams({ origem: e.target.value || null })}
          className={campoClass}
        >
          <option value="">Todas</option>
          {opcoes.origens.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="dash-segmento" label="Segmento">
        <select
          id="dash-segmento"
          value={filtros.segmento ?? ""}
          onChange={(e) => setParams({ segmento: e.target.value || null })}
          className={campoClass}
        >
          <option value="">Todos</option>
          {TIPOS_SEGMENTO.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Campo>

      {temFiltro ? (
        <div className="col-span-2 sm:col-span-3 xl:col-span-7">
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
