"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  tela: string;
  filtros?: Record<string, string | null | undefined>;
  className?: string;
  label?: string;
};

function montarUrl(
  tela: string,
  filtros?: Record<string, string | null | undefined>,
): string {
  const params = new URLSearchParams();
  params.set("tela", tela);
  // override de empresa vendedora vindo da URL da tela (o cookie vai junto no fetch)
  if (typeof window !== "undefined") {
    const atual = new URLSearchParams(window.location.search).get("emitente");
    if (atual) params.set("emitente", atual);
  }
  if (filtros) {
    for (const [k, v] of Object.entries(filtros)) {
      if (v == null) continue;
      const s = String(v).trim();
      if (!s) continue;
      params.set(k, s);
    }
  }
  return `/api/exportar?${params.toString()}`;
}

export function BotaoExportar({
  tela,
  filtros,
  className,
  label = "Exportar Excel",
}: Props) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onClick() {
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch(montarUrl(tela, filtros));
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
          const json = (await res.json()) as { erro?: string };
          if (json.erro) msg = json.erro;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/i.exec(cd);
      const nome = match?.[1] ?? `${tela}.xlsx`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={carregando}
        aria-label={label}
      >
        {carregando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {label}
      </Button>
      {erro ? (
        <p className="max-w-[16rem] text-right text-xs text-destructive">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
