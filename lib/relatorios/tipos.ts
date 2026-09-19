import type { PeriodoResolvido } from "@/lib/relatorios/periodo";

export type FiltrosRelatorio = {
  periodo: PeriodoResolvido;
  vendedorId: string | null;
  linha: string | null;
  origem: string | null;
  isDiretor: boolean;
  /** Gerente: ids da equipe (limita o ranking). null = todos. */
  equipeIds?: string[] | null;
};

export type PresidenciaTop = {
  empresa_nome: string;
  titulo: string;
  valor_estimado: number;
  etapa_nome: string;
  proxima_acao_descricao: string | null;
  proxima_acao_data: string | null;
  responsavel_nome: string;
};

export type PresidenciaPerda = {
  motivo_perda: string;
  qtd: number;
  valor: number;
};

export type PresidenciaPrevisao = {
  mes: string;
  aberto: number;
  realista: number;
  otimista: number;
};

export type DadosPresidencia = {
  mes: string;
  vendido: number;
  qtd_vendida: number;
  ticket_medio: number;
  vendido_mes_anterior: number;
  variacao_pct: number | null;
  perdido: number;
  qtd_perdida: number;
  conversao_pct: number | null;
  previsao: PresidenciaPrevisao[];
  top_negociacoes: PresidenciaTop[];
  perdas: PresidenciaPerda[];
  comentario: string;
};

export type LinhaFunil = {
  funil_id: string;
  funil: string;
  etapa_id: string;
  etapa: string;
  ordem: number;
  qtd: number;
  valor: number;
  /** Negociações (criadas no período) que passaram por esta etapa. */
  passaram: number;
  /** % das que passaram por aqui e chegaram à etapa seguinte. */
  conversao_pct: number | null;
  /** Dias médios de permanência na etapa. */
  dias_medios: number | null;
};

export type LinhaPrevisao = {
  mes: string;
  aberto: number;
  realista: number;
  otimista: number;
  qtd: number;
};

export type LinhaRanking = {
  responsavel_id: string;
  nome: string;
  ativo: boolean;
  vendido: number;
  qtd: number;
  aberto: number;
  conversao_pct: number | null;
  interacoes: number;
  pct_com_acao: number | null;
  acoes_atrasadas: number;
  meta: number;
  atingimento_pct: number | null;
  // período anterior para Δ
  vendido_ant: number;
  qtd_ant: number;
  aberto_ant: number;
  interacoes_ant: number;
};

export type LinhaPerda = {
  motivo: string;
  qtd: number;
  valor: number;
  pct: number;
  qtd_ant: number;
  valor_ant: number;
};

export type NegociacaoPerdaDetalhe = {
  id: string;
  titulo: string;
  empresa_nome: string;
  valor_estimado: number;
  motivo_perda: string;
  anotacao_fechamento: string | null;
  responsavel_nome: string;
  fechado_em: string | null;
  linha: string | null;
};

export type NegociacaoParada = {
  id: string;
  titulo: string;
  empresa_nome: string;
  valor_estimado: number;
  responsavel_nome: string;
  dias_sem_interacao: number;
};

export type EmpresaParada = {
  empresa_id: string;
  empresa_nome: string;
  dias_sem_contato: number;
  responsavel_nome: string | null;
};

export type DadosRelatorios = {
  presidencia: DadosPresidencia | null;
  funil: LinhaFunil[];
  previsao: LinhaPrevisao[];
  ranking: LinhaRanking[];
  perdas: LinhaPerda[];
  perdasDetalhe: NegociacaoPerdaDetalhe[];
  carteiraParada: NegociacaoParada[];
  empresasParadas: EmpresaParada[];
  totais: {
    perdasValor: number;
    perdasValorAnt: number;
    perdasQtd: number;
    perdasQtdAnt: number;
    carteiraValor: number;
    carteiraQtd: number;
    funilValor: number;
    funilQtd: number;
  };
};
