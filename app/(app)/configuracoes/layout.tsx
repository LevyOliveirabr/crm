import { redirect } from "next/navigation";

import {
  ConfiguracoesNav,
  ConfiguracoesSubtitulo,
} from "@/components/crm/configuracoes-nav";
import { Pagina, PaginaCabecalho } from "@/components/crm/pagina";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ehDiretorEmAlguma) {
    redirect("/hoje");
  }

  return (
    <Pagina largura="media">
      <PaginaCabecalho
        titulo="Configurações"
        subtitulo={<ConfiguracoesSubtitulo />}
        descricao="Funis, listas, metas, parâmetros, empresas vendedoras, categorias, produtos, usuários e importação."
      />
      <ConfiguracoesNav />
      {children}
    </Pagina>
  );
}
