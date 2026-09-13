import { redirect } from "next/navigation";

/** Redireciona para a primeira seção de configurações. */
export default function ConfiguracoesPage() {
  redirect("/configuracoes/funis");
}
