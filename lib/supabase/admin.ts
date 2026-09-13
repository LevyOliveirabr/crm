import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Client com service role — bypassa RLS.
 * Uso permitido somente em:
 * - convite de usuários (Configurações)
 * - resolução de API key no MCP (entrega 2)
 * Nunca usar em telas, Server Components ou Server Actions comuns.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
