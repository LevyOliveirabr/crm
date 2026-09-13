import {
  createMcpHandler,
  withMcpAuth,
} from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";

import { clientForApiKey, McpAuthError } from "@/lib/mcp-auth";
import { registrarToolsEResources } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const mcpHandler = createMcpHandler(
  (server) => {
    registrarToolsEResources(server);
  },
  {
    serverInfo: {
      name: "crm-fled",
      version: "1.0.0",
    },
  },
);

async function verifyToken(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  try {
    const headers = new Headers(req.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
    const authReq = new Request(req.url, { method: req.method, headers });
    const auth = await clientForApiKey(authReq);

    return {
      token: bearerToken,
      clientId: auth.usuario.id,
      scopes: ["mcp"],
      extra: {
        keyId: auth.keyId,
        usuarioId: auth.usuario.id,
        keyNome: auth.keyNome,
      },
    };
  } catch (err) {
    if (err instanceof McpAuthError && err.status === 401) {
      return undefined;
    }
    console.error("[mcp-auth]", err);
    return undefined;
  }
}

const handler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
});

export { handler as GET, handler as POST, handler as DELETE };
