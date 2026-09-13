import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { carregarDadosFormNegociacao } from "@/lib/actions/form-negociacao";
import { NovaNegociacaoForm } from "@/components/crm/nova-negociacao-form";

export default async function NovaNegociacaoPage() {
  const res = await carregarDadosFormNegociacao();
  if (!res.ok) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {res.error}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/hoje"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          Nova negociação
        </h1>
      </div>
      <NovaNegociacaoForm dados={res.dados} />
    </div>
  );
}
