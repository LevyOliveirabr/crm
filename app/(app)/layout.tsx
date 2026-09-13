import { redirect } from "next/navigation";

import { AppShell } from "@/components/crm/app-shell";
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

  return <AppShell usuario={usuario}>{children}</AppShell>;
}
