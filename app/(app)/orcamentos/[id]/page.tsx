import { notFound } from "next/navigation";

import { BotaoExportar } from "@/components/crm/botao-exportar";
import { OrcamentoAcoes } from "@/components/crm/orcamento-acoes";
import { OrcamentoDocumento } from "@/components/crm/orcamento-documento";
import { OrcamentoItensEditor } from "@/components/crm/orcamento-itens-editor";
import { Pagina, PaginaCabecalho } from "@/components/crm/pagina";
import { formatarMoeda } from "@/lib/format";
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
    <Pagina largura="estreita">
      <PaginaCabecalho
        voltar={{
          href: `/negociacoes/${o.negociacao.id}`,
          label: o.negociacao.titulo,
        }}
        titulo={`Orçamento ${o.numero ?? ""}`}
        subtitulo={formatarMoeda(o.valor)}
        descricao={
          <>
            {o.empresa.nome}
            {o.emitente ? ` · emitido por ${o.emitente.nome}` : ""}
            {o.editavel ? " · em edição" : ` · ${o.situacao}`}
          </>
        }
        acoes={
          <BotaoExportar
            tela="orcamento-itens"
            filtros={{ orcamento_id: id }}
          />
        }
      />

      <OrcamentoAcoes
        orcamentoId={o.id}
        situacao={o.situacao}
        aceitoEm={o.aceitoEm}
      />

      {o.editavel ? <OrcamentoItensEditor o={o} /> : null}

      <OrcamentoDocumento o={o} />
    </Pagina>
  );
}
