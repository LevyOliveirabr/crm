import { BotaoExportar } from "@/components/crm/botao-exportar";
import { ProdutosConfigClient } from "@/components/crm/produtos-config-client";
import { listarListasPorTipo, listarProdutos } from "@/lib/actions/config";

export default async function ProdutosConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [produtos, linhas] = await Promise.all([
    listarProdutos(q),
    listarListasPorTipo("linha"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Produtos</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro simples para orçamentos (código, nome, linha, preço base).
          </p>
        </div>
        <BotaoExportar tela="produtos" filtros={{ q: q || null }} />
      </div>
      <ProdutosConfigClient
        initial={produtos}
        linhas={linhas.filter((l) => l.ativo).map((l) => l.valor)}
        buscaInicial={q ?? ""}
      />
    </div>
  );
}
