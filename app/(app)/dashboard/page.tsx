import { Suspense } from "react";
import Link from "next/link";

import { DashboardBase } from "@/components/crm/dashboard-base";
import { DashboardCabecalho } from "@/components/crm/dashboard-cabecalho";
import { DashboardFiltros } from "@/components/crm/dashboard-filtros";
import {
  FunilEstagios,
  GraficoTrimestres,
  KpisDashboard,
  ListaNegociacoes,
  MotivosPerdaPainel,
  QuebrasDashboard,
  linkRelatorio,
} from "@/components/crm/dashboard-paineis";
import { carregarDadosFormNegociacao } from "@/lib/actions/form-negociacao";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  idsEquipeVisivel,
  listarVendedoresVisiveis,
  podeVerEquipe,
  resolverFiltroVendedor,
} from "@/lib/auth/equipe";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import {
  carregarDadosDashboard,
  carregarOpcoesDashboard,
} from "@/lib/dashboard/dados";
import {
  METRICAS_DASHBOARD,
  TIPOS_SEGMENTO,
  VISOES_DATA,
  type FiltrosDashboard,
  type MetricaDashboard,
  type TipoSegmento,
  type VisaoData,
} from "@/lib/dashboard/tipos";
import { formatarMoedaCurta } from "@/lib/format";
import {
  adicionarDiasISO,
  hojeISO,
  inicioMesAtualISO,
  inicioProximoMesISO,
  mesPorExtenso,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  de?: string | string[];
  ate?: string | string[];
  vendedor?: string | string[];
  etapa?: string | string[];
  visao?: string | string[];
  metrica?: string | string[];
  uf?: string | string[];
  origem?: string | string[];
  segmento?: string | string[];
  tipo_cliente?: string | string[];
  emitente?: string | string[];
}>;

function paramUnico(
  valor: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

function dataValida(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? null : v;
}

function paramLista(valor: string | string[] | undefined): string[] {
  const bruto = Array.isArray(valor) ? valor : valor ? [valor] : [];
  return bruto
    .flatMap((v) => v.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

function uuidValido(v: string | undefined): string | null {
  if (!v) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    ? v
    : null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const sp = await searchParams;
  const escopo = await getEscopoEmpresa(usuario, sp);
  const isDiretor = podeVerEquipe(usuario, escopo);

  const hoje = hojeISO();
  const inicioMes = inicioMesAtualISO();
  const fimMes = adicionarDiasISO(inicioProximoMesISO(hoje), -1);

  let de = dataValida(paramUnico(sp.de)) ?? inicioMes;
  let ate = dataValida(paramUnico(sp.ate)) ?? fimMes;
  if (ate < de) [de, ate] = [ate, de];

  const visaoParam = paramUnico(sp.visao);
  const visao: VisaoData = VISOES_DATA.some((v) => v.id === visaoParam)
    ? (visaoParam as VisaoData)
    : "previsao";

  const metricaParam = paramUnico(sp.metrica);
  const metrica: MetricaDashboard = METRICAS_DASHBOARD.some(
    (m) => m.id === metricaParam,
  )
    ? (metricaParam as MetricaDashboard)
    : "potencial";

  const supabase = await createClient();
  const vendedores = await listarVendedoresVisiveis(supabase, usuario, escopo);
  const vendedorFiltro = resolverFiltroVendedor(
    usuario,
    vendedores,
    uuidValido(paramUnico(sp.vendedor)) ?? undefined,
    escopo,
  );

  const filtros: FiltrosDashboard = {
    de,
    ate,
    vendedorId: vendedorFiltro,
    etapaIds: paramLista(sp.etapa)
      .map((id) => uuidValido(id))
      .filter((id): id is string => Boolean(id)),
    visao,
    metrica,
    ufs: paramLista(sp.uf)
      .map((u) => u.toUpperCase())
      .filter((u) => /^[A-Z]{2}$/.test(u)),
    origens: paramLista(sp.origem),
    segmentos: paramLista(sp.segmento).filter((s): s is TipoSegmento =>
      TIPOS_SEGMENTO.some((t) => t.id === s),
    ),
    tipoCliente: paramUnico(sp.tipo_cliente)?.trim() || null,
    isDiretor,
    equipeIds: idsEquipeVisivel(usuario, vendedores, escopo),
    emitenteId: escopo.emitenteId,
    usuarioId: usuario.id,
  };

  const [opcoes, dados, dadosNova] = await Promise.all([
    carregarOpcoesDashboard(supabase, vendedores),
    carregarDadosDashboard(supabase, filtros),
    carregarDadosFormNegociacao(),
  ]);

  const qs = new URLSearchParams();
  if (de !== inicioMes) qs.set("de", de);
  if (ate !== fimMes) qs.set("ate", ate);
  if (filtros.vendedorId) qs.set("vendedor", filtros.vendedorId);
  if (filtros.etapaIds.length) qs.set("etapa", filtros.etapaIds.join(","));
  if (filtros.visao !== "previsao") qs.set("visao", filtros.visao);
  if (filtros.metrica !== "potencial") qs.set("metrica", filtros.metrica);
  if (filtros.ufs.length) qs.set("uf", filtros.ufs.join(","));
  if (filtros.origens.length) qs.set("origem", filtros.origens.join(","));
  if (filtros.segmentos.length) qs.set("segmento", filtros.segmentos.join(","));
  if (filtros.tipoCliente) qs.set("tipo_cliente", filtros.tipoCliente);
  if (escopo.emitenteId) qs.set("emitente", escopo.emitenteId);
  const qsStr = qs.toString();

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <DashboardCabecalho
        titulo="Painel comercial"
        subtitulo={`${mesPorExtenso(hoje)} · ${escopo.emitente?.nome ?? "Todas as empresas"}`}
        descricao={
          isDiretor && !filtros.vendedorId
            ? "Visão consolidada · clique em qualquer número para ver o detalhe."
            : "Sua carteira · clique em qualquer número para ver o detalhe."
        }
        pesos={dados.pesos}
        diasRisco={dados.diasRisco}
        dadosNova={dadosNova.ok ? dadosNova.dados : null}
      />

      <Suspense fallback={null}>
        <DashboardFiltros
          filtros={filtros}
          opcoes={opcoes}
          padrao={{ de: inicioMes, ate: fimMes }}
        />
      </Suspense>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,3.6fr)_232px] xl:[grid-template-areas:'pipeline_funil_kpis'_'fechamentos_risco_kpis'_'quebras_quebras_quebras'_'top_fechados_motivos'_'base_base_base']">
        <div className="min-w-0 xl:[grid-area:pipeline]">
          <GraficoTrimestres barras={dados.trimestres} visao={filtros.visao} />
        </div>
        <div className="min-w-0 xl:[grid-area:kpis]">
          <KpisDashboard kpis={dados.kpis} qs={qsStr} />
        </div>
        <div className="min-w-0 xl:[grid-area:funil]">
          <FunilEstagios funis={dados.funis} qs={qsStr} />
        </div>
        <div className="min-w-0 xl:[grid-area:fechamentos]">
          <ListaNegociacoes
            titulo="Próximos fechamentos"
            pill="Alta probabilidade"
            tom="ok"
            itens={dados.proximosFechamentos}
            vazio="Nenhum negócio quente com fechamento previsto nos próximos 30 dias."
          />
        </div>
        <div className="min-w-0 xl:[grid-area:risco]">
          <ListaNegociacoes
            titulo="Oportunidades em risco"
            pill="Ação necessária"
            tom="risco"
            itens={dados.emRisco}
            vazio="Nenhum negócio em risco no momento."
          />
        </div>
        <div className="min-w-0 xl:[grid-area:quebras]">
          <QuebrasDashboard
            porTipoCliente={dados.porTipoCliente}
            porOrigem={dados.porOrigem}
            porUf={dados.porUf}
            qs={qsStr}
          />
        </div>
        <div className="min-w-0 xl:[grid-area:top]">
          <section className="card-surface p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold sm:text-lg">
                Top 10 oportunidades em aberto
              </h2>
              <Link
                href={linkRelatorio(qsStr, "top10")}
                className="text-xs font-semibold text-brand underline-offset-2 hover:underline"
              >
                Ver relatório
              </Link>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              As 10 maiores oportunidades abertas representam{" "}
              <span className="font-semibold text-foreground">
                {dados.kpis.top10Pct.toLocaleString("pt-BR")}%
              </span>{" "}
              do pipeline.
            </p>
            {dados.top10.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum negócio aberto.</p>
            ) : (
              <ol className="divide-y divide-border">
                {dados.top10.map((n, i) => (
                  <li key={n.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-5 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/negociacoes/${n.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {n.empresaNome}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {n.titulo}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatarMoedaCurta(
                        metrica === "previsao" ? n.valorPrevisao : n.valor,
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <div className="min-w-0 xl:[grid-area:fechados]">
          <section className="card-surface p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold sm:text-lg">
                Negócios fechados no período
              </h2>
              <Link
                href={linkRelatorio(qsStr, "fechados")}
                className="text-xs font-semibold text-brand underline-offset-2 hover:underline"
              >
                Ver relatório
              </Link>
            </div>
            {dados.fechadosPeriodo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum ganho ou perda no período.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {dados.fechadosPeriodo.map((n) => (
                  <li key={n.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`/negociacoes/${n.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {n.empresaNome}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="truncate">{n.titulo}</span>
                      <span
                        className={
                          n.status === "vendida"
                            ? "font-semibold text-success"
                            : "font-semibold text-destructive"
                        }
                      >
                        {n.status === "vendida" ? "Ganho" : "Perda"}
                      </span>
                      <span className="tabular-nums">
                        {formatarMoedaCurta(n.valor)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="min-w-0 xl:[grid-area:motivos]">
          <MotivosPerdaPainel itens={dados.motivosPerda} qs={qsStr} />
        </div>
        <div className="min-w-0 xl:[grid-area:base]">
          <DashboardBase linhas={dados.base} />
        </div>
      </div>
    </div>
  );
}
