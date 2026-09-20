import Link from "next/link";
import { redirect } from "next/navigation";

import { ApiKeysClient } from "@/components/crm/api-keys-client";
import { listarApiKeys } from "@/lib/actions/api-keys";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";

export default async function ApiKeysPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const keys = await listarApiKeys();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div>
        <div className="mb-2 flex flex-wrap gap-3 text-sm">
          {usuario.ehDiretorEmAlguma ? (
            <Link
              href="/configuracoes/usuarios"
              className="text-muted-foreground hover:text-foreground"
            >
              Usuários
            </Link>
          ) : null}
          <span className="font-medium text-foreground">API keys</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o Cursor ou Claude Desktop ao CRM via MCP. Endpoint:{" "}
          <code className="text-xs">/api/mcp/mcp</code>
        </p>
      </div>

      <ApiKeysClient keysIniciais={keys} />
    </div>
  );
}
