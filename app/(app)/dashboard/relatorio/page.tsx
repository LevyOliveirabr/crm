import Link from "next/link";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  idsEquipeVisivel,
  listarVendedoresVisiveis,
  podeVerEquipe,
  resolverFiltroVendedor,
} from "@/lib/auth/equipe";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { carregarDadosDashboard } from "@/lib/dashboard/dados";
import {
  METRICAS_DASHBOARD,
  TIPOS_SEGMENTO,
  VISOES_DATA,
  type FiltrosDashboard,
  type MetricaDashboard,
  type NegociacaoResumo,
  type TipoSegmento,
  type VisaoData,
} from "@/lib/dashboard/tipos";
import {
  adicionarDiasISO,
  formatarMoeda,
  hojeISO,
  inicioMesAtualISO,
  inicioProximoMesISO,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Pagina, PaginaCabecalho } from "@/components/crm/pagina";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v,
  )
    ? v
    : null;
}

const TITULOS: Record<string, string> = {
  pipeline: "Pipeline potencial — detalhe",
  previsao: "Previsão de faturamento — detalhe",
  previsao90: "Previsão próximos 90 dias — detalhe",
  winrate: "Taxa de ganho — fechamentos do período",
  etapa: "Negociações da etapa",
  tipo_cliente: "Por tipo de cliente",
  origem: "Por origem do lead",
  top10: "Top 10 oportunidades",
  fechados: "Negócios fechados no período",
  motivo: "Perdas por motivo",
  risco: "Oportunidades em risco",
  proximos: "Próximos fechamentos",
};

export default async function DashboardRelatorioPage({
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
  const segmentoParam = paramUnico(sp.segmento);
  const segmento: TipoSegmento | null = TIPOS_SEGMENTO.some(
    (t) => t.id === segmentoParam,
  )
    ? (segmentoParam as TipoSegmento)
    : null;
  const ufParam = paramUnico(sp.uf)?.trim().toUpperCase();

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
    etapaId: uuidValido(paramUnico(sp.etapa)),
    visao,
    metrica,
    uf: ufParam && /^[A-Z]{2}$/.test(ufParam) ? ufParam : null,
    origem: paramUnico(sp.origem)?.trim() || null,
    segmento,
    tipoCliente: paramUnico(sp.tipo_cliente)?.trim() || null,
    isDiretor,
    equipeIds: idsEquipeVisivel(usuario, vendedores, escopo),
    emitenteId: escopo.emitenteId,
  };

  const dados = await carregarDadosDashboard(supabase, filtros);
  const fonte = paramUnico(sp.fonte) ?? "pipeline";
  const chave = paramUnico(sp.chave)?.trim() ?? "";

  let itens: NegociacaoResumo[] = [];
  let titulo = TITULOS[fonte] ?? "Relatório";

  if (fonte === "pipeline" || fonte === "previsao") {
    itens = dados.base.map((b) => ({
      id: b.id,
      titulo: b.titulo,
      empresaNome: b.empresaNome,
      empresaId: b.empresaId,
      responsavelNome: b.responsavelNome,
      etapaNome: b.etapaNome,
      valor: b.valor,
      valorPrevisao: b.valorPrevisao,
      previsaoMes: b.previsaoMes,
      previsaoData: b.previsaoData,
    }));
  } else if (fonte === "previsao90") {
    const limite = adicionarDiasISO(hoje, 90);
    itens = dados.base
      .filter((b) => {
        const ref = b.previsaoData ?? b.previsaoMes;
        return ref && ref >= hoje && ref <= limite;
      })
      .map((b) => ({
        id: b.id,
        titulo: b.titulo,
        empresaNome: b.empresaNome,
        empresaId: b.empresaId,
        responsavelNome: b.responsavelNome,
        etapaNome: b.etapaNome,
        valor: b.valor,
        valorPrevisao: b.valorPrevisao,
        previsaoMes: b.previsaoMes,
        previsaoData: b.previsaoData,
      }));
  } else if (fonte === "winrate" || fonte === "fechados") {
    itens = dados.fechadosPeriodo;
  } else if (fonte === "etapa" && chave) {
    itens = dados.base
      .filter((b) => {
        const funil = dados.funis.find((f) =>
          f.etapas.some((e) => e.etapaId === chave),
        );
        const et = funil?.etapas.find((e) => e.etapaId === chave);
        return et ? b.etapaNome === et.nome : false;
      })
      .map((b) => ({
        id: b.id,
        titulo: b.titulo,
        empresaNome: b.empresaNome,
        empresaId: b.empresaId,
        responsavelNome: b.responsavelNome,
        etapaNome: b.etapaNome,
        valor: b.valor,
        valorPrevisao: b.valorPrevisao,
        previsaoMes: b.previsaoMes,
        previsaoData: b.previsaoData,
      }));
    const nomeEtapa =
      dados.funis
        .flatMap((f) => f.etapas)
        .find((e) => e.etapaId === chave)?.nome ?? chave;
    titulo = `Etapa: ${nomeEtapa}`;
  } else if (fonte === "tipo_cliente" && chave) {
    itens = dados.base
      .filter(
        (b) =>
          (b.tipoCliente ?? "").trim() === chave ||
          (!(b.tipoCliente ?? "").trim() && chave === "Sem classificação"),
      )
      .map((b) => ({
        id: b.id,
        titulo: b.titulo,
        empresaNome: b.empresaNome,
        empresaId: b.empresaId,
        responsavelNome: b.responsavelNome,
        etapaNome: b.etapaNome,
        valor: b.valor,
        valorPrevisao: b.valorPrevisao,
        previsaoMes: b.previsaoMes,
        previsaoData: b.previsaoData,
      }));
    titulo = `Tipo de cliente: ${chave}`;
  } else if (fonte === "origem" && chave) {
    itens = dados.base
      .filter(
        (b) =>
          (b.origem ?? "").trim() === chave ||
          (!(b.origem ?? "").trim() && chave === "Sem classificação"),
      )
      .map((b) => ({
        id: b.id,
        titulo: b.titulo,
        empresaNome: b.empresaNome,
        empresaId: b.empresaId,
        responsavelNome: b.responsavelNome,
        etapaNome: b.etapaNome,
        valor: b.valor,
        valorPrevisao: b.valorPrevisao,
        previsaoMes: b.previsaoMes,
        previsaoData: b.previsaoData,
      }));
    titulo = `Origem: ${chave}`;
  } else if (fonte === "top10") {
    itens = dados.top10;
  } else if (fonte === "motivo" && chave) {
    itens = dados.fechadosPeriodo.filter(
      (n) =>
        n.status === "perdida" &&
        ((n.motivoPerda ?? "").trim() || "Sem motivo") === chave,
    );
    titulo = `Motivo: ${chave}`;
  } else if (fonte === "risco") {
    itens = dados.emRisco;
  } else if (fonte === "proximos") {
    itens = dados.proximosFechamentos;
  } else {
    itens = dados.base.map((b) => ({
      id: b.id,
      titulo: b.titulo,
      empresaNome: b.empresaNome,
      empresaId: b.empresaId,
      responsavelNome: b.responsavelNome,
      etapaNome: b.etapaNome,
      valor: b.valor,
      valorPrevisao: b.valorPrevisao,
      previsaoMes: b.previsaoMes,
      previsaoData: b.previsaoData,
    }));
  }

  const total = itens.reduce(
    (s, n) => s + (metrica === "previsao" ? n.valorPrevisao : n.valor),
    0,
  );

  const voltarQs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = paramUnico(v);
    if (val && k !== "fonte" && k !== "chave") voltarQs.set(k, val);
  }
  const voltarHref = `/dashboard${voltarQs.toString() ? `?${voltarQs}` : ""}`;

  return (
    <Pagina>
      <PaginaCabecalho
        voltar={{ href: voltarHref, label: "Dashboard" }}
        titulo={titulo}
        subtitulo={`${itens.length} ${itens.length === 1 ? "negociação" : "negociações"} · ${formatarMoeda(total)}`}
        descricao="Lista das negociações que entram neste número. Clique para abrir a ficha."
      />

      {itens.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted-foreground">
          Nenhuma negociação neste recorte.
        </p>
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="eyebrow px-3 py-2">Empresa</th>
                <th className="eyebrow px-3 py-2">Projeto</th>
                <th className="eyebrow px-3 py-2">Etapa</th>
                <th className="eyebrow px-3 py-2">Responsável</th>
                <th className="eyebrow px-3 py-2 text-right">Potencial</th>
                <th className="eyebrow px-3 py-2 text-right">Previsão</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((n) => (
                <tr key={n.id} className="border-b border-border">
                  <td className="px-3 py-2">
                    <Link
                      href={`/negociacoes/${n.id}`}
                      className="font-medium hover:underline"
                    >
                      {n.empresaNome}
                    </Link>
                    {n.status ? (
                      <span
                        className={
                          n.status === "vendida"
                            ? "ml-2 text-xs font-semibold text-success"
                            : n.status === "perdida"
                              ? "ml-2 text-xs font-semibold text-destructive"
                              : "ml-2 text-xs text-muted-foreground"
                        }
                      >
                        {n.status === "vendida"
                          ? "Ganho"
                          : n.status === "perdida"
                            ? "Perda"
                            : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-muted-foreground">
                    {n.titulo}
                  </td>
                  <td className="px-3 py-2">{n.etapaNome}</td>
                  <td className="px-3 py-2">{n.responsavelNome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatarMoeda(n.valor)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatarMoeda(n.valorPrevisao)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2" colSpan={4}>
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatarMoeda(itens.reduce((s, n) => s + n.valor, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatarMoeda(
                    itens.reduce((s, n) => s + n.valorPrevisao, 0),
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Pagina>
  );
}
