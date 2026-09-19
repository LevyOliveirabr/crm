"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { aceitarOrcamentoPorToken } from "@/lib/actions/orcamento-aceite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AceiteOrcamentoClient({
  token,
  jaAceito,
  vencido,
  disponivel,
}: {
  token: string;
  jaAceito: boolean;
  vencido: boolean;
  disponivel: boolean;
}) {
  const [nome, setNome] = useState("");
  const [feito, setFeito] = useState(jaAceito);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (feito) {
    return (
      <div className="card-surface flex items-center gap-3 border-success bg-success-bg p-4 text-success">
        <CheckCircle2 className="size-6 shrink-0" />
        <div>
          <p className="font-semibold">Orçamento aceito</p>
          <p className="text-sm">O vendedor já foi avisado. Obrigado!</p>
        </div>
      </div>
    );
  }

  if (vencido) {
    return (
      <div className="card-surface p-4 text-sm text-muted-foreground">
        Este orçamento venceu. Fale com o vendedor para receber uma nova versão.
      </div>
    );
  }

  if (!disponivel) {
    return (
      <div className="card-surface p-4 text-sm text-muted-foreground">
        Este orçamento foi substituído por uma versão mais recente.
      </div>
    );
  }

  return (
    <form
      className="card-surface flex flex-col gap-3 p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        startTransition(async () => {
          const res = await aceitarOrcamentoPorToken({ token, nome });
          if (!res.ok) {
            setErro(res.error);
            return;
          }
          setFeito(true);
        });
      }}
    >
      <p className="font-semibold">Aceitar este orçamento</p>
      <label htmlFor="aceite-nome" className="text-sm text-muted-foreground">
        Seu nome (fica registrado como responsável pelo aceite)
      </label>
      <Input
        id="aceite-nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome completo"
        required
        minLength={2}
        className="max-w-sm"
      />
      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}
      <div>
        <Button type="submit" size="lg" className="rounded-full px-5 font-semibold" disabled={pending}>
          {pending ? "Registrando…" : "Aceito o orçamento"}
        </Button>
      </div>
    </form>
  );
}
