export const CONTACT_STATUSES = ["Lead", "Active", "Inactive"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const DEAL_STAGES = [
  "Lead",
  "Qualified",
  "Proposal",
  "Won",
  "Lost",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const OPEN_STAGES: DealStage[] = ["Lead", "Qualified", "Proposal"];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function contactStatusClasses(status: string): string {
  switch (status) {
    case "Active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "Lead":
      return "bg-blue-50 text-blue-700 ring-blue-600/20";
    case "Inactive":
      return "bg-zinc-100 text-zinc-600 ring-zinc-500/20";
    default:
      return "bg-zinc-100 text-zinc-600 ring-zinc-500/20";
  }
}

export function dealStageClasses(stage: string): string {
  switch (stage) {
    case "Lead":
      return "bg-sky-50 text-sky-700 ring-sky-600/20";
    case "Qualified":
      return "bg-indigo-50 text-indigo-700 ring-indigo-600/20";
    case "Proposal":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "Won":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "Lost":
      return "bg-rose-50 text-rose-700 ring-rose-600/20";
    default:
      return "bg-zinc-100 text-zinc-600 ring-zinc-500/20";
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
