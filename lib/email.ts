/**
 * Envio de e-mail transacional via Resend (API HTTP, sem SDK).
 *
 * Variáveis:
 * - RESEND_API_KEY: chave da conta Resend. Sem ela, o envio é pulado
 *   (retorna `skipped: true`) e nada quebra.
 * - EMAIL_FROM: remetente, ex. "CRM F-Led <crm@fled.com.br>". O domínio
 *   precisa estar verificado no Resend. Padrão: onboarding@resend.dev
 *   (só entrega para o e-mail dono da conta Resend).
 */

export type EnvioEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped: true }
  | { ok: false; skipped?: false; error: string };

export function emailHabilitado(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function enviarEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<EnvioEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, skipped: true };

  const from =
    process.env.EMAIL_FROM?.trim() || "CRM F-Led <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${corpo.slice(0, 300)}` };
    }
    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: json?.id ?? null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao enviar e-mail.",
    };
  }
}

/** Escapa texto para uso dentro de HTML. */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
