"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  alternarProdutoAtivo,
  salvarProduto,
} from "@/lib/actions/config";
import type { Database } from "@/lib/database.types";
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

type Produto = Database["public"]["Tables"]["produtos"]["Row"];

export function ProdutosConfigClient({
  initial,
  linhas,
  buscaInicial,
}: {
  initial: Produto[];
  linhas: string[];
  buscaInicial: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<Produto | null>(null);
  const [aberto, setAberto] = useState(false);

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
            onClick={() => {
              setEditando(null);
              setAberto(true);
            }}
          >
            + Produto
          </Button>
        </form>

        {aberto ? (
          <form
            className="grid max-w-xl gap-3 rounded-xl border border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await salvarProduto({
                  id: editando?.id,
                  codigo: String(fd.get("codigo") ?? "") || null,
                  nome: String(fd.get("nome") ?? ""),
                  descricao: String(fd.get("descricao") ?? "") || null,
                  linha: String(fd.get("linha") ?? "") || null,
                  unidade: String(fd.get("unidade") ?? "un") || "un",
                  preco_base: Number(
                    String(fd.get("preco_base") ?? "0").replace(",", "."),
                  ),
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
            <h2 className="font-medium">
              {editando ? "Editar produto" : "Novo produto"}
            </h2>
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
              Descrição
              <Textarea
                name="descricao"
                className="mt-1"
                rows={2}
                defaultValue={editando?.descricao ?? ""}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Linha</TableHead>
              <TableHead>Preço</TableHead>
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
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{p.linha ?? "—"}</TableCell>
                <TableCell>{formatarMoeda(p.preco_base)}</TableCell>
                <TableCell>
                  <Badge variant={p.ativo ? "secondary" : "outline"}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditando(p);
                      setAberto(true);
                    }}
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
                </TableCell>
              </TableRow>
            ))}
            {initial.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
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
