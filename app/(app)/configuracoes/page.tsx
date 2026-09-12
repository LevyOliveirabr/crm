import { redirect } from "next/navigation";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";

/** Etapa 02: só usuários. Demais seções de configurações vêm depois. */
export default async function ConfiguracoesPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.perfil !== "diretor") {
    redirect("/hoje");
  }
  redirect("/configuracoes/usuarios");
}
