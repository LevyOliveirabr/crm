"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#f2f2ef",
          color: "#1a1a18",
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ color: "#6b6b66", fontSize: 14 }}>
            O erro foi registrado. Tente de novo; se persistir, avise o suporte
            {error.digest ? ` informando o código ${error.digest}` : ""}.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              background: "#111",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
