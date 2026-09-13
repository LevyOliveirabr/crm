/** Rate limit simples em memória: 60 chamadas/min por API key. */

const LIMITE = 60;
const JANELA_MS = 60_000;

const hits = new Map<string, number[]>();

export function checarRateLimit(keyId: string): {
  ok: boolean;
  restante: number;
} {
  const agora = Date.now();
  const corte = agora - JANELA_MS;
  const anteriores = (hits.get(keyId) ?? []).filter((t) => t > corte);

  if (anteriores.length >= LIMITE) {
    hits.set(keyId, anteriores);
    return { ok: false, restante: 0 };
  }

  anteriores.push(agora);
  hits.set(keyId, anteriores);
  return { ok: true, restante: LIMITE - anteriores.length };
}
