import * as Sentry from "@sentry/nextjs";

/**
 * Monitoramento de erros (Sentry). Desligado quando SENTRY_DSN está vazio.
 * Cobre os runtimes Node e Edge; o cliente é configurado em
 * instrumentation-client.ts.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
