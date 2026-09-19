"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";

import { consultarCnpj, type DadosCnpj } from "@/lib/actions/cnpj";
import { Button } from "@/components/ui/button";

/**
 * Botão "Buscar" ao lado do campo CNPJ: consulta a Receita (BrasilAPI) e
 * devolve os dados para o formulário decidir o que preencher.
 */
export function BotaoConsultarCnpj({
  cnpj,
  onDados,
  disabled = false,
  size = "sm",
}: {
  cnpj: string;
  onDados: (dados: DadosCnpj) => void;
  disabled?: boolean;
  size?: "sm" | "default";
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const digitos = cnpj.replace(/\D/g, "");

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size={size}
        variant="outline"
        disabled={disabled || pending || digitos.length !== 14}
        title="Preencher razão social, cidade e UF pela Receita Federal"
        onClick={() => {
          setErro(null);
          startTransition(async () => {
            const res = await consultarCnpj(digitos);
            if (!res.ok) {
              setErro(res.error);
              return;
            }
            onDados(res.dados);
          });
        }}
      >
        <Search className="size-3.5" />
        {pending ? "Buscando…" : "Buscar na Receita"}
      </Button>
      {erro ? (
        <span className="text-xs text-destructive" role="alert">
          {erro}
        </span>
      ) : null}
    </div>
  );
}
