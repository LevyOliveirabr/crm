"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";

import {
  adicionarItemOrcamento,
  atualizarItemOrcamento,
  buscarProdutosParaOrcamento,
  removerItemOrcamento,
  salvarCabecalhoOrcamento,
  usarTotalComoValorNegociacao,
} from "@/lib/actions/orcamentos";
import type { OrcamentoCompleto } from "@/lib/orcamentos/dados";
import { formatarMoeda, parseMoedaBR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster, toast } from "@/components/ui/toast";

type ProdutoOpcao = Awaited<
  ReturnType<typeof buscarProdutosParaOrcamento>
>[number];

/**
 * Editor do orçamento montado por itens: busca produtos do catálogo da
 * empresa vendedora, item livre, edição em linha de quantidade/preço/desconto,
 * cabeçalho (validade, condições, prazo, frete, observações, desconto geral).
 */
export function OrcamentoItensEditor({ o }: { o: OrcamentoCompleto }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [opcoes, setOpcoes] = useState<ProdutoOpcao[]>([]);
  const [livreAberto, setLivreAberto] = useState(false);
  const [livre, setLivre] = useState({
    descricao: "",
    unidade: "un",
    quantidade: "1",
    preco: "",
  });

  useEffect(() => {
    if (busca.trim().length < 2) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      const res = await buscarProdutosParaOrcamento(o.id, busca);
      if (!cancelado) setOpcoes(res);
    }, 220);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [busca, o.id]);

  function mudarBusca(valor: string) {
    setBusca(valor);
    if (valor.trim().length < 2) setOpcoes([]);
  }

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.add({ title: res.error ?? "Falha.", type: "error" });
        return;
      }
      if (okMsg) toast.add({ title: okMsg, type: "success" });
      router.refresh();
    });
  }

  return (
    <Toaster>
      <section className="card-surface flex flex-col gap-4 border-l-4 border-l-brand p-4 sm:p-5 print:hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-base font-semibold sm:text-lg">
            Montar orçamento
          </h2>
          <p className="text-xs text-muted-foreground">
            Produtos do catálogo de {o.emitente?.nome ?? "—"}. Preço e descrição
            são editáveis item a item.
          </p>
        </div>

        {/* Busca de produto */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => mudarBusca(e.target.value)}
                placeholder="Buscar produto por nome ou código…"
                className="pl-8"
                disabled={pending}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLivreAberto((v) => !v)}
            >
              <Plus className="size-4" /> Item livre
            </Button>
          </div>
          {opcoes.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-md">
              {opcoes.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setBusca("");
                      setOpcoes([]);
                      run(
                        () =>
                          adicionarItemOrcamento(o.id, {
                            produto_id: p.id,
                            quantidade: 1,
                          }),
                        "Item adicionado",
                      );
                    }}
                  >
                    <span>
                      <span className="font-medium">{p.nome}</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {[p.codigo, p.categoria].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatarMoeda(p.preco_base)}/{p.unidade}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {livreAberto ? (
          <form
            className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[1fr_5rem_6rem_8rem_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  adicionarItemOrcamento(o.id, {
                    descricao: livre.descricao,
                    unidade: livre.unidade,
                    quantidade: Number(livre.quantidade.replace(",", ".")),
                    preco_unitario: parseMoedaBR(livre.preco) ?? 0,
                  }),
                "Item adicionado",
              );
              setLivre({
                descricao: "",
                unidade: "un",
                quantidade: "1",
                preco: "",
              });
              setLivreAberto(false);
            }}
          >
            <Input
              placeholder="Descrição *"
              required
              value={livre.descricao}
              onChange={(e) =>
                setLivre((v) => ({ ...v, descricao: e.target.value }))
              }
            />
            <Input
              placeholder="un"
              value={livre.unidade}
              onChange={(e) =>
                setLivre((v) => ({ ...v, unidade: e.target.value }))
              }
            />
            <Input
              placeholder="Qtd"
              inputMode="decimal"
              value={livre.quantidade}
              onChange={(e) =>
                setLivre((v) => ({ ...v, quantidade: e.target.value }))
              }
            />
            <Input
              placeholder="Preço unit."
              inputMode="decimal"
              value={livre.preco}
              onChange={(e) =>
                setLivre((v) => ({ ...v, preco: e.target.value }))
              }
            />
            <Button type="submit" disabled={pending}>
              Adicionar
            </Button>
          </form>
        ) : null}

        {/* Itens editáveis */}
        {o.itens.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-input text-left">
                  <th className="eyebrow px-2 py-1">Descrição</th>
                  <th className="eyebrow px-2 py-1">Un</th>
                  <th className="eyebrow px-2 py-1 text-right">Qtd</th>
                  <th className="eyebrow px-2 py-1 text-right">Unitário</th>
                  <th className="eyebrow px-2 py-1 text-right">Desc. %</th>
                  <th className="eyebrow px-2 py-1 text-right">Total</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {o.itens.map((i) => (
                  <LinhaItem
                    key={i.id}
                    orcamentoId={o.id}
                    item={i}
                    pending={pending}
                    run={run}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum item ainda. Busque um produto acima ou adicione um item
            livre.
          </p>
        )}

        {/* Cabeçalho / condições */}
        <form
          className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const str = (k: string) => String(fd.get(k) ?? "").trim();
            run(
              () =>
                salvarCabecalhoOrcamento(o.id, {
                  titulo: str("titulo") || null,
                  validade: str("validade") || null,
                  condicoes_pagamento: str("condicoes_pagamento") || null,
                  prazo_entrega: str("prazo_entrega") || null,
                  frete: str("frete") || null,
                  observacoes: str("observacoes") || null,
                  desconto_geral_pct: Number(
                    str("desconto_geral_pct").replace(",", ".") || "0",
                  ),
                }),
              "Condições salvas",
            );
          }}
        >
          <label className="text-sm sm:col-span-2">
            Título / referência
            <Input
              name="titulo"
              className="mt-1"
              defaultValue={o.titulo ?? ""}
            />
          </label>
          <label className="text-sm">
            Validade
            <Input
              name="validade"
              type="date"
              className="mt-1"
              defaultValue={o.validade ?? ""}
            />
          </label>
          <label className="text-sm">
            Desconto geral (%)
            <Input
              name="desconto_geral_pct"
              inputMode="decimal"
              className="mt-1"
              defaultValue={String(o.descontoGeralPct)}
            />
          </label>
          <label className="text-sm">
            Condições de pagamento
            <Textarea
              name="condicoes_pagamento"
              rows={2}
              className="mt-1"
              defaultValue={o.condicoesPagamento ?? ""}
            />
          </label>
          <label className="text-sm">
            Prazo de entrega
            <Input
              name="prazo_entrega"
              className="mt-1"
              defaultValue={o.prazoEntrega ?? ""}
            />
          </label>
          <label className="text-sm">
            Frete
            <Input
              name="frete"
              placeholder="CIF / FOB / a combinar"
              className="mt-1"
              defaultValue={o.frete ?? ""}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Observações
            <Textarea
              name="observacoes"
              rows={2}
              className="mt-1"
              defaultValue={o.observacoes ?? ""}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Salvar condições
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || o.itens.length === 0}
              onClick={() =>
                run(
                  () => usarTotalComoValorNegociacao(o.id),
                  "Valor da negociação atualizado",
                )
              }
            >
              Usar total ({formatarMoeda(o.valor)}) como valor da negociação
            </Button>
          </div>
        </form>
      </section>
    </Toaster>
  );
}

function LinhaItem({
  orcamentoId,
  item,
  pending,
  run,
}: {
  orcamentoId: string;
  item: OrcamentoCompleto["itens"][number];
  pending: boolean;
  run: (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string,
  ) => void;
}) {
  const [v, setV] = useState({
    descricao: item.descricao,
    unidade: item.unidade,
    quantidade: String(item.quantidade),
    preco: String(item.precoUnitario),
    desconto: String(item.descontoPct),
  });

  function salvar() {
    const quantidade = Number(v.quantidade.replace(",", "."));
    const preco = parseMoedaBR(v.preco) ?? Number(v.preco.replace(",", "."));
    const desconto = Number(v.desconto.replace(",", "."));
    if (
      v.descricao === item.descricao &&
      v.unidade === item.unidade &&
      quantidade === item.quantidade &&
      preco === item.precoUnitario &&
      desconto === item.descontoPct
    ) {
      return;
    }
    run(() =>
      atualizarItemOrcamento(orcamentoId, item.id, {
        descricao: v.descricao,
        unidade: v.unidade,
        quantidade,
        preco_unitario: preco,
        desconto_pct: desconto,
      }),
    );
  }

  const cls =
    "h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring";
  return (
    <tr className="border-b border-border">
      <td className="px-2 py-1">
        <input
          aria-label="Descrição"
          className={`${cls} w-full`}
          value={v.descricao}
          disabled={pending}
          onChange={(e) => setV((s) => ({ ...s, descricao: e.target.value }))}
          onBlur={salvar}
        />
        {item.produto ? (
          <span className="text-xs text-muted-foreground">
            {item.produto.nome}
            {item.produto.codigo ? ` · ${item.produto.codigo}` : ""}
          </span>
        ) : null}
      </td>
      <td className="px-2 py-1">
        <input
          aria-label="Unidade"
          className={`${cls} w-14`}
          value={v.unidade}
          disabled={pending}
          onChange={(e) => setV((s) => ({ ...s, unidade: e.target.value }))}
          onBlur={salvar}
        />
      </td>
      <td className="px-2 py-1 text-right">
        <input
          aria-label="Quantidade"
          inputMode="decimal"
          className={`${cls} w-20 text-right`}
          value={v.quantidade}
          disabled={pending}
          onChange={(e) => setV((s) => ({ ...s, quantidade: e.target.value }))}
          onBlur={salvar}
        />
      </td>
      <td className="px-2 py-1 text-right">
        <input
          aria-label="Preço unitário"
          inputMode="decimal"
          className={`${cls} w-28 text-right`}
          value={v.preco}
          disabled={pending}
          onChange={(e) => setV((s) => ({ ...s, preco: e.target.value }))}
          onBlur={salvar}
        />
      </td>
      <td className="px-2 py-1 text-right">
        <input
          aria-label="Desconto %"
          inputMode="decimal"
          className={`${cls} w-16 text-right`}
          value={v.desconto}
          disabled={pending}
          onChange={(e) => setV((s) => ({ ...s, desconto: e.target.value }))}
          onBlur={salvar}
        />
      </td>
      <td className="px-2 py-1 text-right font-semibold tabular-nums">
        {formatarMoeda(item.total)}
      </td>
      <td className="px-2 py-1 text-right">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          aria-label="Remover item"
          disabled={pending}
          onClick={() => run(() => removerItemOrcamento(orcamentoId, item.id))}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </td>
    </tr>
  );
}
