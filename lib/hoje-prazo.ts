/**
 * Constantes de prazo do Meu dia — módulo sem "use client" para poder
 * ser importado por Server Components (ex.: app/(app)/hoje/page.tsx).
 */
export const PRAZOS_HOJE = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "amanha", label: "Amanhã" },
  { id: "7atras", label: "Últimos 7 dias" },
  { id: "7frente", label: "Próximos 7 dias" },
  { id: "30frente", label: "Próximos 30 dias" },
  { id: "custom", label: "Período…" },
] as const;

export type PrazoHojeId = (typeof PRAZOS_HOJE)[number]["id"];

export function isPrazoHojeId(valor: string | undefined): valor is PrazoHojeId {
  return Boolean(valor && PRAZOS_HOJE.some((p) => p.id === valor));
}
