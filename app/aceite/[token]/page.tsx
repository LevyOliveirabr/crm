import type { Metadata } from "next";

import { AceiteOrcamentoClient } from "@/components/crm/aceite-orcamento-client";
import { OrcamentoDocumento } from "@/components/crm/orcamento-documento";
import { hojeISO } from "@/lib/format";
import { verificarTokenAceite } from "@/lib/orcamentos/aceite-token";
import { carregarOrcamentoCompleto } from "@/lib/orcamentos/dados";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Aceite de orçamento · F-Led",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Página pública (link assinado) para o cliente ver e aceitar o orçamento. */
export default async function AceitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const orcamentoId = await verificarTokenAceite(token);

  const o = orcamentoId
    ? await carregarOrcamentoCompleto(createAdminClient(), orcamentoId)
    : null;

  if (!o) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-3 px-4 py-10 text-center">
        <h1 className="text-xl font-semibold">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground">
          Peça ao vendedor um novo link de aceite.
        </p>
      </main>
    );
  }

  const vencido = Boolean(o.validade && o.validade < hojeISO());
  const jaAceito = Boolean(o.aceitoEm);
  const disponivel = o.situacao === "enviado";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="print:hidden">
        <p className="eyebrow">Proposta comercial</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {o.emitente?.razaoSocial ?? "F-Led"} para {o.empresa.nome}
        </h1>
        <p className="text-sm text-muted-foreground">
          Revise o orçamento abaixo. Ao aceitar, o vendedor recebe a confirmação no sistema.
        </p>
      </header>

      <AceiteOrcamentoClient
        token={token}
        jaAceito={jaAceito}
        vencido={vencido}
        disponivel={disponivel}
      />

      <OrcamentoDocumento o={o} />
    </main>
  );
}
