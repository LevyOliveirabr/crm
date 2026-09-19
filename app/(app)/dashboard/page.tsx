import { Suspense } from "react";

import { DashboardBase } from "@/components/crm/dashboard-base";
import { DashboardCabecalho } from "@/components/crm/dashboard-cabecalho";
import { DashboardFiltros } from "@/components/crm/dashboard-filtros";
import {
  FunilEstagios,
  GraficoTrimestres,
  KpisDashboard,
  ListaNegociacoes,
} from "@/components/crm/dashboard-paineis";
import { carregarDadosFormNegociacao } from "@/lib/actions/form-negociacao";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  carregarDadosDashboard,
  carregarOpcoesDashboard,
} from "@/lib/dashboard/dados";
import {
  TIPOS_SEGMENTO,
  VISOES_DATA,
  type FiltrosDashboard,
  type TipoSegmento,
  type VisaoData,
} from "@/lib/dashboard/tipos";
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
  uf?: string | string[];
  origem?: string | string[];
  segmento?: string | string[];
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
  const isDiretor = usuario.perfil === "diretor";

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

  const segmentoParam = paramUnico(sp.segmento);
  const segmento: TipoSegmento | null = TIPOS_SEGMENTO.some(
    (t) => t.id === segmentoParam,
  )
    ? (segmentoParam as TipoSegmento)
    : null;

  const ufParam = paramUnico(sp.uf)?.trim().toUpperCase();

  const filtros: FiltrosDashboard = {
    de,
    ate,
    vendedorId: isDiretor ? uuidValido(paramUnico(sp.vendedor)) : null,
    etapaId: uuidValido(paramUnico(sp.etapa)),
    visao,
    uf: ufParam && /^[A-Z]{2}$/.test(ufParam) ? ufParam : null,
    origem: paramUnico(sp.origem)?.trim() || null,
    segmento,
    isDiretor,
  };

  const supabase = await createClient();

  const [opcoes, dados, dadosNova] = await Promise.all([
    carregarOpcoesDashboard(supabase, isDiretor),
    carregarDadosDashboard(supabase, filtros),
    carregarDadosFormNegociacao(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <DashboardCabecalho
        titulo="Sua carteira"
        subtitulo={mesPorExtenso(hoje)}
        descricao={
          isDiretor && !filtros.vendedorId
            ? "Visão consolidada das negociações abertas de toda a equipe."
            : "Visão consolidada das suas negociações abertas."
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,3.6fr)_232px] xl:[grid-template-areas:'pipeline_funil_kpis'_'fechamentos_risco_kpis'_'base_base_base']">
        <div className="min-w-0 xl:[grid-area:pipeline]">
          <GraficoTrimestres barras={dados.trimestres} visao={filtros.visao} />
        </div>
        <div className="min-w-0 xl:[grid-area:kpis]">
          <KpisDashboard kpis={dados.kpis} />
        </div>
        <div className="min-w-0 xl:[grid-area:funil]">
          <FunilEstagios funis={dados.funis} />
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
        <div className="min-w-0 xl:[grid-area:base]">
          <DashboardBase linhas={dados.base} />
        </div>
      </div>
    </div>
  );
}
