import { redirect } from "next/navigation";

import { ApiKeysClient } from "@/components/crm/api-keys-client";
import { listarApiKeys } from "@/lib/actions/api-keys";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";

export default async function ApiKeysPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const keys = await listarApiKeys();

  return <ApiKeysClient keysIniciais={keys} />;
}
