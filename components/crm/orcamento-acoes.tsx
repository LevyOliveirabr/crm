"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Printer } from "lucide-react";

import { gerarLinkAceite } from "@/lib/actions/orcamento-aceite";
import { Button } from "@/components/ui/button";

export function OrcamentoAcoes({
  orcamentoId,
  situacao,
  aceitoEm,
}: {
  orcamentoId: string;
  situacao: string;
  aceitoEm: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeGerar = situacao === "enviado" && !aceitoEm;

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir / salvar PDF
        </Button>
        {podeGerar ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setErro(null);
              startTransition(async () => {
                const res = await gerarLinkAceite(orcamentoId);
                if (!res.ok) {
                  setErro(res.error);
                  return;
                }
                setLink(res.url);
                await copiar(res.url);
              });
            }}
          >
            <Link2 className="size-4" />
            {pending ? "Gerando…" : "Copiar link de aceite"}
          </Button>
        ) : null}
      </div>
      {link ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 truncate font-mono" title={link}>
            {link}
          </span>
          <Button type="button" size="xs" variant="ghost" onClick={() => copiar(link)}>
            {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiado ? "Copiado" : "Copiar"}
          </Button>
          <span className="w-full text-muted-foreground">
            Envie ao cliente por WhatsApp ou e-mail. O link vale 60 dias e registra o aceite na negociação.
          </span>
        </div>
      ) : null}
      {erro ? (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
