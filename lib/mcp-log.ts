import type { Json } from "@/lib/database.types";
import type { McpAuthContext } from "@/lib/mcp-auth";

export async function registrarMcpLog(
  auth: McpAuthContext,
  input: {
    tool: string;
    args: unknown;
    ok: boolean;
    erro?: string | null;
    ms: number;
  },
): Promise<void> {
  const { error } = await auth.supabase.from("mcp_log").insert({
    key_id: auth.keyId,
    tool: input.tool,
    args: (input.args ?? null) as Json,
    ok: input.ok,
    erro: input.erro ?? null,
    ms: Math.round(input.ms),
  });

  if (error) {
    console.error("[mcp_log]", error.message);
  }
}
