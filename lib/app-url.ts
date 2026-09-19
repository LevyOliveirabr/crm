/**
 * URL pública do app para links de e-mail (convite / esqueci senha).
 * Em produção na Vercel nunca deve cair em localhost.
 */
export function getAppUrl(): string {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) {
    return configured;
  }

  // Domínio de produção do projeto (Vercel injeta automaticamente)
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(
    /^https?:\/\//,
    "",
  );
  if (productionHost) {
    return `https://${productionHost.replace(/\/$/, "")}`;
  }

  // Host do deployment atual (preview ou prod)
  const vercelHost = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "");
  if (vercelHost) {
    return `https://${vercelHost.replace(/\/$/, "")}`;
  }

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return "https://crm-fled.vercel.app";
  }

  return configured || "http://localhost:3000";
}
