import type { Database } from "@/lib/database.types";

export type TipoSegmento = Database["public"]["Enums"]["tipo_segmento"];

export type VisaoData = "previsao" | "criacao" | "fechamento";

export const VISOES_DATA: { id: VisaoData; label: string }[] = [
  { id: "previsao", label: "Previsão de fechamento" },
  { id: "criacao", label: "Data de criação" },
  { id: "fechamento", label: "Fechamento real (vendas)" },
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
  etapaId: string | null;
  visao: VisaoData;
  uf: string | null;
  origem: string | null;
  segmento: TipoSegmento | null;
  isDiretor: boolean;
};

export type OpcoesDashboard = {
  vendedores: { id: string; nome: string }[];
  etapas: { id: string; nome: string; funil: string }[];
  ufs: string[];
  origens: string[];
};

export type Kpis = {
  pipelineTotal: number;
  qtdAbertas: number;
  pipelinePonderado: number;
  winRate: number | null;
  winRateAnterior: number | null;
  qtdVendidas: number;
  qtdPerdidas: number;
  forecastMes: number;
  forecastMesQtd: number;
  forecastMesSeguinte: number;
  forecastMesSeguinteQtd: number;
  forecastTrimestre: number;
  forecastTrimestreQtd: number;
  forecastTrimestreAnterior: number;
  mesAtual: string;
  mesSeguinte: string;
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

export type NegociacaoResumo = {
  id: string;
  titulo: string;
  empresaNome: string;
  empresaId: string;
  responsavelNome: string;
  etapaNome: string;
  valor: number;
  previsaoMes: string | null;
  /** Só em "risco": motivo legível. */
  motivo?: string;
  /** Só em "risco": dias parada. */
  diasSemInteracao?: number;
};

export type LinhaBase = {
  id: string;
  titulo: string;
  linha: string | null;
  empresaId: string;
  empresaNome: string;
  responsavelNome: string;
  etapaNome: string;
  segmento: TipoSegmento | null;
  valor: number;
  previsaoMes: string | null;
  dataFaturamento: string | null;
  temperatura: number;
};

export type DadosDashboard = {
  kpis: Kpis;
  trimestres: BarraTrimestre[];
  funis: FunilDashboard[];
  proximosFechamentos: NegociacaoResumo[];
  emRisco: NegociacaoResumo[];
  base: LinhaBase[];
  pesos: { fria: number; morna: number; quente: number };
  diasRisco: number;
};
