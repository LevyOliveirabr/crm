import type { Database } from "@/lib/database.types";

export type TipoSegmento = Database["public"]["Enums"]["tipo_segmento"];

export type VisaoData = "previsao" | "criacao" | "fechamento";

/** Métrica dos valores no funil / top 10 / quebras. */
export type MetricaDashboard = "potencial" | "previsao";

export const VISOES_DATA: { id: VisaoData; label: string }[] = [
  { id: "previsao", label: "Previsão de fechamento" },
  { id: "criacao", label: "Data de criação" },
  { id: "fechamento", label: "Fechamento real (vendas)" },
];

export const METRICAS_DASHBOARD: { id: MetricaDashboard; label: string }[] = [
  { id: "potencial", label: "Valor potencial" },
  { id: "previsao", label: "Valor previsão" },
];

export const TIPOS_SEGMENTO: { id: TipoSegmento; label: string }[] = [
  { id: "publico", label: "Público" },
  { id: "privado", label: "Privado" },
  { id: "ppp", label: "PPP" },
];

export function rotuloSegmento(tipo: TipoSegmento | null | undefined): string {
  return TIPOS_SEGMENTO.find((t) => t.id === tipo)?.label ?? "—";
}

export type FiltrosDashboard = {
  /** Período (yyyy-mm-dd, inclusivo) usado no win rate e na visão "fechamento". */
  de: string;
  ate: string;
  vendedorId: string | null;
  etapaIds: string[];
  visao: VisaoData;
  metrica: MetricaDashboard;
  ufs: string[];
  origens: string[];
  segmentos: TipoSegmento[];
  /** Tipo de cliente (lista segmento da empresa). */
  tipoCliente: string | null;
  isDiretor: boolean;
  /** Ids visíveis (gerente: equipe; vendedor: ele mesmo). null = todos. */
  equipeIds?: string[] | null;
  /** Empresa vendedora selecionada; null = todas. */
  emitenteId?: string | null;
  /** Usuário logado — para separar meta pessoal da soma da equipe. */
  usuarioId?: string | null;
};

export type OpcoesDashboard = {
  vendedores: { id: string; nome: string }[];
  etapas: { id: string; nome: string; funil: string }[];
  ufs: string[];
  origens: string[];
  tiposCliente: string[];
};

export type Kpis = {
  /** Pipeline potencial = Σ valor_estimado abertas. */
  pipelineTotal: number;
  qtdAbertas: number;
  /** Previsão de faturamento = Σ valor_previsao (fallback potencial). */
  previsaoFaturamento: number;
  /** % previsão / potencial. */
  previsaoPctPotencial: number;
  /** Pipeline ponderado (legado / temperatura). */
  pipelinePonderado: number;
  /** Taxa de ganho por valor no período. */
  winRate: number | null;
  winRateAnterior: number | null;
  /** Taxa de ganho por quantidade. */
  winRateNegocio: number | null;
  qtdVendidas: number;
  qtdPerdidas: number;
  /** Previsão nos próximos 90 dias. */
  previsao90: number;
  forecastMes: number;
  forecastMesQtd: number;
  forecastMesSeguinte: number;
  forecastMesSeguinteQtd: number;
  forecastTrimestre: number;
  forecastTrimestreQtd: number;
  forecastTrimestreAnterior: number;
  mesAtual: string;
  mesSeguinte: string;
  /** Vendido (valor final) no mês atual, dentro dos filtros. */
  vendidoMes: number;
  /** Soma das metas de faturamento do mês (equipe ou pessoa filtrada). */
  metaMes: number;
  /** Meta de faturamento só do usuário logado. */
  metaPessoal: number;
  /** Meta de pipeline (negócios novos) no mês. */
  metaPipeline: number;
  /** Valor estimado das negociações criadas no mês. */
  pipelineGerado: number;
  /** Valor faturado no mês (faturado_em). */
  faturadoMes: number;
  /** Aberto com previsão já vencida. */
  previsaoVencida: number;
  qtdPrevisaoVencida: number;
  /** As 10 maiores / pipeline potencial. */
  top10Pct: number;
  forecastCompromisso: number;
  forecastProvavel: number;
  forecastPossivel: number;
  forecastSemCategoria: number;
};

export type BarraTrimestre = {
  ano: number;
  trimestre: 1 | 2 | 3 | 4;
  valor: number;
  qtd: number;
  atual: boolean;
  futuro: boolean;
};

export type EtapaFunil = {
  etapaId: string;
  nome: string;
  ordem: number;
  qtd: number;
  valor: number;
};

export type FunilDashboard = {
  funilId: string;
  nome: string;
  etapas: EtapaFunil[];
  total: number;
  qtd: number;
};

export type QuebraItem = {
  chave: string;
  label: string;
  qtd: number;
  valor: number;
};

export type NegociacaoResumo = {
  id: string;
  titulo: string;
  empresaNome: string;
  empresaId: string;
  responsavelNome: string;
  etapaNome: string;
  valor: number;
  valorPrevisao: number;
  previsaoMes: string | null;
  previsaoData: string | null;
  status?: "aberta" | "vendida" | "perdida";
  motivoPerda?: string | null;
  /** Só em "risco": motivo legível. */
  motivo?: string;
  /** Só em "risco": dias parada. */
  diasSemInteracao?: number;
};

export type MotivoPerdaItem = {
  motivo: string;
  qtd: number;
  valor: number;
};

export type LinhaBase = {
  id: string;
  titulo: string;
  linha: string | null;
  empresaId: string;
  empresaNome: string;
  empresaUf: string | null;
  responsavelNome: string;
  etapaNome: string;
  segmento: TipoSegmento | null;
  tipoCliente: string | null;
  origem: string | null;
  valor: number;
  valorPrevisao: number;
  negocioUnico: boolean;
  previsaoMes: string | null;
  previsaoData: string | null;
  dataFaturamento: string | null;
  temperatura: number;
  categoriaForecast: "compromisso" | "provavel" | "possivel" | null;
};

export type DadosDashboard = {
  kpis: Kpis;
  trimestres: BarraTrimestre[];
  funis: FunilDashboard[];
  porTipoCliente: QuebraItem[];
  porOrigem: QuebraItem[];
  porUf: QuebraItem[];
  previsaoVencidaLista: NegociacaoResumo[];
  top10: NegociacaoResumo[];
  /** Vendas do mês corrente (valor final) que formam o KPI Vendido no mês. */
  vendidosMes: NegociacaoResumo[];
  faturadosMes: NegociacaoResumo[];
  fechadosPeriodo: NegociacaoResumo[];
  motivosPerda: MotivoPerdaItem[];
  proximosFechamentos: NegociacaoResumo[];
  emRisco: NegociacaoResumo[];
  base: LinhaBase[];
  pesos: { fria: number; morna: number; quente: number };
  diasRisco: number;
};

/** Fontes do drill-down `/dashboard/relatorio`. */
export type FonteRelatorio =
  | "pipeline"
  | "previsao"
  | "previsao90"
  | "winrate"
  | "etapa"
  | "tipo_cliente"
  | "origem"
  | "top10"
  | "vendido"
  | "faturado"
  | "vencida"
  | "pipeline_gerado"
  | "uf"
  | "fechados"
  | "motivo"
  | "risco"
  | "proximos";
