import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BotaoExportar } from "@/components/crm/botao-exportar";
import { OrcamentoAcoes } from "@/components/crm/orcamento-acoes";
import { OrcamentoDocumento } from "@/components/crm/orcamento-documento";
import { OrcamentoItensEditor } from "@/components/crm/orcamento-itens-editor";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { carregarOrcamentoCompleto } from "@/lib/orcamentos/dados";
import { createClient } from "@/lib/supabase/server";

export default async function OrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const { id } = await params;
  const supabase = await createClient();
  const o = await carregarOrcamentoCompleto(supabase, id);
  if (!o) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            href={`/negociacoes/${o.negociacao.id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {o.negociacao.titulo}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Orçamento {o.numero ?? ""}
          </h1>
        </div>
        <BotaoExportar tela="orcamento-itens" filtros={{ orcamento_id: id }} />
      </header>

      <OrcamentoAcoes orcamentoId={o.id} situacao={o.situacao} aceitoEm={o.aceitoEm} />

      {o.editavel ? <OrcamentoItensEditor o={o} /> : null}

      <OrcamentoDocumento o={o} />
    </div>
  );
}
