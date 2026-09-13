import { BotaoExportar } from "@/components/crm/botao-exportar";

/** Shell mínimo do editor com exportação de itens (UI completa na entrega 3). */
export default async function OrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Orçamento</h1>
        <BotaoExportar
          tela="orcamento-itens"
          filtros={{ orcamento_id: id }}
        />
      </header>
      <p className="text-sm text-muted-foreground">
        Exportar Excel baixa todos os itens deste orçamento. O editor completo
        (PDF/Excel gerado) chega na entrega 3.
      </p>
    </div>
  );
}
