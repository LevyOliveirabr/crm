import { BotaoExportar } from "@/components/crm/botao-exportar";
import { ProdutosConfigClient } from "@/components/crm/produtos-config-client";
import { listarListasPorTipo, listarProdutos } from "@/lib/actions/config";
import { listarCategorias } from "@/lib/actions/emitentes";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { empresasOndeEhDiretor } from "@/lib/auth/permissoes";

export default async function ProdutosConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; emitente?: string }>;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;
  const sp = await searchParams;
  const q = sp.q;
  const escopo = await getEscopoEmpresa(usuario, sp);
  const dirigidas = new Set(empresasOndeEhDiretor(usuario));

  const [produtos, linhas, categorias] = await Promise.all([
    listarProdutos(q, escopo.emitenteId),
    listarListasPorTipo("linha"),
    listarCategorias(null),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Produtos</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro por empresa vendedora: código, categoria, preço base, link
            no site e catálogo. {escopo.emitente ? `Mostrando: ${escopo.emitente.nome}.` : "Mostrando todas as empresas."}
          </p>
        </div>
        <BotaoExportar tela="produtos" filtros={{ q: q || null }} />
      </div>
      <ProdutosConfigClient
        initial={produtos}
        linhas={linhas.filter((l) => l.ativo).map((l) => l.valor)}
        buscaInicial={q ?? ""}
        emitentes={usuario.empresas
          .filter((e) => dirigidas.has(e.id))
          .map((e) => ({ id: e.id, nome: e.nome }))}
        emitenteInicial={escopo.emitenteId && dirigidas.has(escopo.emitenteId) ? escopo.emitenteId : null}
        categorias={categorias
          .filter((c) => c.ativo)
          .map((c) => ({ id: c.id, nome: c.nome, emitente_id: c.emitente_id }))}
      />
    </div>
  );
}
