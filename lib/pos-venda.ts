/** Venda que ainda precisa de faturamento, entrega, pagamento ou tarefa aberta. */
export function vendaEmAcompanhamento(row: {
  faturado: boolean | null;
  entregue: boolean | null;
  pago: boolean | null;
  sem_acao: boolean | null;
}): boolean {
  const marcosOk =
    Boolean(row.faturado) && Boolean(row.entregue) && Boolean(row.pago);
  const temAcaoAberta = row.sem_acao === false;
  return !marcosOk || temAcaoAberta;
}

export function marcosPendentes(row: {
  faturado: boolean | null;
  entregue: boolean | null;
  pago: boolean | null;
}): string[] {
  const itens: string[] = [];
  if (!row.faturado) itens.push("Faturar");
  if (!row.entregue) itens.push("Entregar");
  if (!row.pago) itens.push("Receber pagamento");
  return itens;
}
