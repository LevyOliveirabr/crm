import { redirect } from "next/navigation";

import { ConfiguracoesNav } from "@/components/crm/configuracoes-nav";
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Funis, listas, metas, parâmetros, empresas vendedoras, categorias, produtos, usuários e importação.
        </p>
      </div>
      <ConfiguracoesNav />
      {children}
    </div>
  );
}
