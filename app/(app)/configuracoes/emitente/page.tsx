import { redirect } from "next/navigation";

/** Rota antiga (emitente único) → empresas vendedoras. */
export default function EmitentePage() {
  redirect("/configuracoes/empresas-vendedoras");
}
