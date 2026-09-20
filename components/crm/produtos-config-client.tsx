"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Paperclip } from "lucide-react";

import {
  alternarProdutoAtivo,
  salvarProduto,
  type ProdutoLista,
} from "@/lib/actions/config";
import {
  removerCatalogo,
  uploadCatalogoProduto,
} from "@/lib/actions/emitentes";
import { formatarMoeda } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "@/components/ui/toast";
import { formularioClass, subPainelClass } from "@/components/crm/pagina";
import { cn } from "@/lib/utils";

export type CategoriaOpcao = { id: string; nome: string; emitente_id: string };

export function ProdutosConfigClient({
  initial,
  linhas,
  buscaInicial,
  emitentes,
  emitenteInicial,
  categorias,
}: {
  initial: ProdutoLista[];
  linhas: string[];
  buscaInicial: string;
  /** Empresas em que o usuário é diretor. */
  emitentes: { id: string; nome: string }[];
  emitenteInicial: string | null;
  categorias: CategoriaOpcao[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<ProdutoLista | null>(null);
  const [aberto, setAberto] = useState(false);
  const [emitenteForm, setEmitenteForm] = useState<string>(
    emitenteInicial ?? emitentes[0]?.id ?? "",
  );
  const categoriasDaEmpresa = categorias.filter(
    (c) => c.emitente_id === emitenteForm,
  );

  function abrir(p: ProdutoLista | null) {
    setEditando(p);
    setEmitenteForm(
      p?.emitente_id ?? emitenteInicial ?? emitentes[0]?.id ?? "",
    );
    setAberto(true);
  }

  return (
    <Toaster>
      <div className="flex flex-col gap-6">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q");
            router.push(
              `/configuracoes/produtos${q ? `?q=${encodeURIComponent(String(q))}` : ""}`,
            );
          }}
        >
          <Input
            name="q"
            placeholder="Buscar por código, nome…"
            defaultValue={buscaInicial}
          />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
          <Button
            type="button"
            onClick={() => abrir(null)}
            disabled={emitentes.length === 0}
          >
            + Produto
          </Button>
        </form>

        {aberto ? (
          <form
            key={editando?.id ?? "novo"}
            className={cn(formularioClass, "grid max-w-xl gap-3")}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const str = (k: string) => String(fd.get(k) ?? "").trim();
              startTransition(async () => {
                const res = await salvarProduto({
                  id: editando?.id,
                  emitente_id: emitenteForm,
                  codigo: str("codigo") || null,
                  nome: str("nome"),
                  descricao: str("descricao") || null,
                  linha: str("linha") || null,
                  categoria_id: str("categoria_id") || null,
                  unidade: str("unidade") || "un",
                  preco_base: Number(
                    str("preco_base").replace(",", ".") || "0",
                  ),
                  link: str("link") || null,
                  catalogo_url: str("catalogo_url") || null,
                  ativo: fd.get("ativo") === "on",
                });
                if (!res.ok) {
                  toast.add({ title: res.error, type: "error" });
                  return;
                }
                toast.add({ title: "Produto salvo", type: "success" });
                setAberto(false);
                setEditando(null);
                router.refresh();
              });
            }}
          >
            <h3 className="font-heading text-sm font-semibold">
              {editando ? "Editar produto" : "Novo produto"}
            </h3>
            <label className="text-sm">
              Empresa vendedora *
              <select
                value={emitenteForm}
                onChange={(e) => setEmitenteForm(e.target.value)}
                disabled={Boolean(editando)}
                className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {emitentes.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.nome}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Código
                <Input
                  name="codigo"
                  className="mt-1"
                  defaultValue={editando?.codigo ?? ""}
                />
              </label>
              <label className="text-sm">
                Unidade
                <Input
                  name="unidade"
                  className="mt-1"
                  defaultValue={editando?.unidade ?? "un"}
                />
              </label>
            </div>
            <label className="text-sm">
              Nome *
              <Input
                name="nome"
                required
                className="mt-1"
                defaultValue={editando?.nome ?? ""}
              />
            </label>
            <label className="text-sm">
              Descrição (sai na proposta)
              <Textarea
                name="descricao"
                className="mt-1"
                rows={2}
                defaultValue={editando?.descricao ?? ""}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Categoria
                <select
                  name="categoria_id"
                  className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  defaultValue={editando?.categoria_id ?? ""}
                >
                  <option value="">—</option>
                  {categoriasDaEmpresa.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Linha
                <select
                  name="linha"
                  className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  defaultValue={editando?.linha ?? ""}
                >
                  <option value="">—</option>
                  {linhas.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-sm">
              Preço base
              <Input
                name="preco_base"
                type="number"
                step="0.01"
                min={0}
                className="mt-1"
                defaultValue={editando?.preco_base ?? 0}
              />
            </label>
            <label className="text-sm">
              Link do produto no site da empresa
              <Input
                name="link"
                placeholder="https://"
                className="mt-1"
                defaultValue={editando?.link ?? ""}
              />
            </label>
            <label className="text-sm">
              Catálogo hospedado (URL) — ou anexe o arquivo abaixo depois de
              salvar
              <Input
                name="catalogo_url"
                placeholder="https://"
                className="mt-1"
                defaultValue={editando?.catalogo_url ?? ""}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="ativo"
                defaultChecked={editando?.ativo ?? true}
              />
              Ativo
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                Salvar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAberto(false);
                  setEditando(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}

        {editando && aberto ? (
          <form
            className={cn(
              subPainelClass,
              "flex max-w-xl flex-wrap items-end gap-2 border-dashed",
            )}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await uploadCatalogoProduto(
                  editando.id,
                  editando.emitente_id,
                  fd,
                );
                if (!res.ok) {
                  toast.add({ title: res.error, type: "error" });
                  return;
                }
                toast.add({ title: "Catálogo anexado", type: "success" });
                router.refresh();
              });
            }}
          >
            <div className="w-full text-sm font-medium">
              Catálogo do produto (PDF ou imagem, até 10 MB)
              {editando.catalogo_path ? " · arquivo anexado" : ""}
            </div>
            <Input
              name="catalogo"
              type="file"
              accept="application/pdf,image/*"
              required
            />
            <Button type="submit" variant="secondary" disabled={pending}>
              <Paperclip className="size-4" /> Anexar catálogo
            </Button>
            {editando.catalogo_path ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await removerCatalogo(
                      "produto",
                      editando.id,
                      editando.emitente_id,
                    );
                    if (!res.ok) toast.add({ title: res.error, type: "error" });
                    router.refresh();
                  })
                }
              >
                Remover arquivo
              </Button>
            ) : null}
          </form>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Links</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initial.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">
                  {p.codigo ?? "—"}
                </TableCell>
                <TableCell className="font-medium">
                  {p.nome}
                  {p.linha ? (
                    <p className="text-xs text-muted-foreground">{p.linha}</p>
                  ) : null}
                </TableCell>
                <TableCell>{p.emitente_nome}</TableCell>
                <TableCell>{p.categoria_nome ?? "—"}</TableCell>
                <TableCell>{formatarMoeda(p.preco_base)}</TableCell>
                <TableCell className="space-x-2 text-xs">
                  {p.link ? (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      <ExternalLink className="size-3" /> site
                    </a>
                  ) : null}
                  {p.catalogo_url_final ? (
                    <a
                      href={p.catalogo_url_final}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      <Paperclip className="size-3" /> catálogo
                    </a>
                  ) : null}
                  {!p.link && !p.catalogo_url_final ? (
                    <span className="text-muted-foreground">—</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant={p.ativo ? "secondary" : "outline"}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  {p.podeEditar ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => abrir(p)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            await alternarProdutoAtivo(p.id, !p.ativo);
                            router.refresh();
                          });
                        }}
                      >
                        {p.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      só leitura
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {initial.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Nenhum produto.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Toaster>
  );
}
