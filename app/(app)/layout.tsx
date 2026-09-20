import { redirect } from "next/navigation";

import { AppShell } from "@/components/crm/app-shell";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    redirect("/login");
  }
  if (!usuario.ativo) {
    redirect("/login?erro=inativo");
  }

  const escopo = await getEscopoEmpresa(usuario);

  return (
    <AppShell
      usuario={usuario}
      escopo={{ emitenteId: escopo.emitenteId, empresas: escopo.empresas, fixo: escopo.fixo }}
    >
      {children}
    </AppShell>
  );
}
