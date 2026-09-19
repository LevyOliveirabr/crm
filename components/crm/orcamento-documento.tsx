import type { OrcamentoCompleto } from "@/lib/orcamentos/dados";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/format";

const SITUACAO_LABEL: Record<string, string> = {
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  substituido: "Substituído",
};

/**
 * Documento do orçamento (cabeçalho do emitente, cliente, itens, totais).
 * Server-safe; usado na tela interna (com impressão) e na página de aceite.
 */
export function OrcamentoDocumento({ o }: { o: OrcamentoCompleto }) {
  const temItens = o.itens.length > 0;
  const subtotal = o.subtotal ?? o.itens.reduce((s, i) => s + i.total, 0);

  return (
    <article className="relatorio-print card-surface p-6 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-4">
          {o.emitente?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={o.emitente.logoUrl}
              alt={o.emitente.razaoSocial}
              className="h-14 w-auto max-w-[160px] object-contain"
            />
          ) : null}
          <div>
            <p className="font-heading text-lg font-bold">
              {o.emitente?.razaoSocial ?? "F-Led"}
            </p>
            <p className="text-xs text-muted-foreground">
              {[o.emitente?.cnpj ? `CNPJ ${o.emitente.cnpj}` : null, o.emitente?.endereco]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-xs text-muted-foreground">
              {[o.emitente?.telefone, o.emitente?.email, o.emitente?.site]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="eyebrow">Orçamento</p>
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {o.numero ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Emitido em {formatarData(o.enviadoEm)}
            {o.validade ? ` · válido até ${formatarData(o.validade)}` : ""}
          </p>
          <p className="mt-1 text-xs font-semibold">
            {SITUACAO_LABEL[o.situacao] ?? o.situacao}
            {o.aceitoEm ? ` · aceito em ${formatarDataHora(o.aceitoEm)}` : ""}
          </p>
        </div>
      </header>

      <section className="grid gap-4 py-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Cliente</p>
          <p className="mt-1 font-semibold">{o.empresa.nome}</p>
          <p className="text-xs text-muted-foreground">
            {[o.empresa.cnpj ? `CNPJ ${o.empresa.cnpj}` : null, [o.empresa.cidade, o.empresa.uf].filter(Boolean).join("/")]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {o.contato ? (
            <p className="text-xs text-muted-foreground">
              A/C {o.contato.nome}
              {o.contato.email ? ` · ${o.contato.email}` : ""}
            </p>
          ) : null}
        </div>
        <div className="sm:text-right">
          <p className="eyebrow">Referência</p>
          <p className="mt-1 font-semibold">{o.titulo ?? o.negociacao.titulo}</p>
          <p className="text-xs text-muted-foreground">
            Vendedor: {o.negociacao.responsavelNome}
            {o.negociacao.responsavelEmail ? ` · ${o.negociacao.responsavelEmail}` : ""}
          </p>
        </div>
      </section>

      {temItens ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-input">
                <th className="eyebrow px-2 py-2 text-left">#</th>
                <th className="eyebrow px-2 py-2 text-left">Descrição</th>
                <th className="eyebrow px-2 py-2 text-right">Qtd</th>
                <th className="eyebrow px-2 py-2 text-left">Un</th>
                <th className="eyebrow px-2 py-2 text-right">Unitário</th>
                <th className="eyebrow px-2 py-2 text-right">Desc.</th>
                <th className="eyebrow px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {o.itens.map((i, idx) => (
                <tr key={i.id} className="border-b border-border">
                  <td className="px-2 py-2 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-2 py-2">{i.descricao}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {i.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-2 py-2">{i.unidade}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatarMoeda(i.precoUnitario)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {i.descontoPct > 0 ? `${i.descontoPct}%` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatarMoeda(i.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {o.descontoGeralPct > 0 ? (
                <>
                  <tr>
                    <td colSpan={6} className="px-2 pt-3 text-right text-muted-foreground">
                      Subtotal
                    </td>
                    <td className="px-2 pt-3 text-right tabular-nums">{formatarMoeda(subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-2 py-1 text-right text-muted-foreground">
                      Desconto geral {o.descontoGeralPct}%
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      − {formatarMoeda(subtotal - o.valor)}
                    </td>
                  </tr>
                </>
              ) : null}
              <tr className="border-t-2 border-input">
                <td colSpan={6} className="px-2 py-3 text-right font-semibold">
                  Total
                </td>
                <td className="px-2 py-3 text-right font-heading text-lg font-semibold tabular-nums">
                  {formatarMoeda(o.valor)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm">
            Valor total:{" "}
            <b className="font-heading text-lg tabular-nums">{formatarMoeda(o.valor)}</b>
          </p>
          {o.arquivoUrl ? (
            <p className="mt-1 text-sm">
              Proposta detalhada em PDF:{" "}
              <a
                href={o.arquivoUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline underline-offset-4"
              >
                abrir arquivo
              </a>
            </p>
          ) : null}
        </div>
      )}

      {(o.condicoesPagamento || o.prazoEntrega || o.frete || o.observacoes) ? (
        <section className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          {o.condicoesPagamento ? (
            <div>
              <p className="eyebrow">Pagamento</p>
              <p className="mt-1">{o.condicoesPagamento}</p>
            </div>
          ) : null}
          {o.prazoEntrega ? (
            <div>
              <p className="eyebrow">Prazo de entrega</p>
              <p className="mt-1">{o.prazoEntrega}</p>
            </div>
          ) : null}
          {o.frete ? (
            <div>
              <p className="eyebrow">Frete</p>
              <p className="mt-1">{o.frete}</p>
            </div>
          ) : null}
          {o.observacoes ? (
            <div className="sm:col-span-3">
              <p className="eyebrow">Observações</p>
              <p className="mt-1 whitespace-pre-line">{o.observacoes}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {o.emitente?.rodape ? (
        <footer className="mt-6 border-t border-border pt-3 text-xs whitespace-pre-line text-muted-foreground">
          {o.emitente.rodape}
        </footer>
      ) : null}
    </article>
  );
}
