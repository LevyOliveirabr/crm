import { createHash, randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

import type { EmpresaDoUsuario } from "@/lib/auth/get-usuario-atual";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type UsuarioMcp = Omit<
  Database["public"]["Tables"]["usuarios"]["Row"],
  "perfil" | "gerente_id"
> & {
  /** Empresas vendedoras em que o dono da key participa (perfil por empresa). */
  empresas: EmpresaDoUsuario[];
};

export type McpAuthContext = {
  supabase: SupabaseClient<Database>;
  usuario: UsuarioMcp;
  keyId: string;
  keyNome: string;
};

export class McpAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "McpAuthError";
    this.status = status;
  }
}

/** Gera key de 32 bytes em base64url (só exibida uma vez). */
export function gerarApiKeyPlaintext(): string {
  return randomBytes(32).toString("base64url");
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

function extrairBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

async function assinarJwtUsuario(usuarioId: string): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new McpAuthError("SUPABASE_JWT_SECRET não configurado.", 500);
  }

  const agora = Math.floor(Date.now() / 1000);
  return new SignJWT({
    role: "authenticated",
    aud: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(usuarioId)
    .setIssuedAt(agora)
    .setExpirationTime(agora + 5 * 60)
    .setAudience("authenticated")
    .sign(new TextEncoder().encode(secret));
}

function clientAnonComJwt(jwt: string): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new McpAuthError("Supabase não configurado.", 500);
  }

  return createClient<Database>(url, anon, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Resolve a API key do header Authorization (Bearer), valida (não revogada),
 * assina JWT do dono e devolve client anon com RLS do usuário.
 * Único fluxo que usa service role (só para lookup da key).
 */
export async function clientForApiKey(
  request: Request,
): Promise<McpAuthContext> {
  const plaintext = extrairBearer(request);
  if (!plaintext) {
    throw new McpAuthError("Authorization Bearer ausente.");
  }

  const keyHash = hashApiKey(plaintext);
  const admin = createAdminClient();

  const { data: keyRow, error: keyError } = await admin
    .from("api_keys")
    .select("id, nome, usuario_id, revogado_em")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError) {
    throw new McpAuthError(`Falha ao validar API key: ${keyError.message}`, 500);
  }
  if (!keyRow) {
    throw new McpAuthError("API key inválida.");
  }
  if (keyRow.revogado_em) {
    throw new McpAuthError("API key revogada.");
  }

  const { data: usuario, error: userError } = await admin
    .from("usuarios")
    .select("*")
    .eq("id", keyRow.usuario_id)
    .maybeSingle();

  if (userError || !usuario) {
    throw new McpAuthError("Usuário da API key não encontrado.");
  }
  if (!usuario.ativo) {
    throw new McpAuthError("Usuário inativo.");
  }

  type VinculoJoin = {
    emitente_id: string;
    perfil: EmpresaDoUsuario["perfil"];
    gerente_id: string | null;
    emitentes: { nome: string; ativo: boolean } | { nome: string; ativo: boolean }[] | null;
  };
  const { data: vinculos } = await admin
    .from("usuario_emitentes")
    .select("emitente_id, perfil, gerente_id, emitentes ( nome, ativo )")
    .eq("usuario_id", usuario.id);
  const empresas: EmpresaDoUsuario[] = ((vinculos ?? []) as unknown as VinculoJoin[])
    .map((v) => {
      const em = Array.isArray(v.emitentes) ? v.emitentes[0] : v.emitentes;
      return {
        id: v.emitente_id,
        nome: em?.nome ?? "—",
        perfil: v.perfil,
        gerenteId: v.gerente_id,
        ativo: em?.ativo ?? true,
      };
    })
    .filter((e) => e.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const jwt = await assinarJwtUsuario(usuario.id);
  const supabase = clientAnonComJwt(jwt);

  const { perfil: _perfil, gerente_id: _gerente, ...resto } = usuario;
  void _perfil;
  void _gerente;

  return {
    supabase,
    usuario: { ...resto, empresas },
    keyId: keyRow.id,
    keyNome: keyRow.nome,
  };
}
