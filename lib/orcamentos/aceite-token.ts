import { SignJWT, jwtVerify } from "jose";

const DIAS_VALIDADE_LINK = 60;

function segredo(): Uint8Array {
  const s =
    process.env.ACEITE_SECRET?.trim() || process.env.SUPABASE_JWT_SECRET?.trim();
  if (!s) throw new Error("ACEITE_SECRET (ou SUPABASE_JWT_SECRET) não configurado.");
  return new TextEncoder().encode(s);
}

/** Gera o token assinado do link público de aceite de um orçamento. */
export async function gerarTokenAceite(orcamentoId: string): Promise<string> {
  return new SignJWT({ typ: "aceite", oid: orcamentoId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DIAS_VALIDADE_LINK}d`)
    .sign(segredo());
}

/** Valida o token e devolve o id do orçamento, ou null. */
export async function verificarTokenAceite(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: ["HS256"] });
    if (payload.typ !== "aceite" || typeof payload.oid !== "string") return null;
    return payload.oid;
  } catch {
    return null;
  }
}
