"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Paperclip } from "lucide-react";

import {
  removerCatalogo,
  salvarCategoria,
  uploadCatalogoCategoria,
  type CategoriaRow,
} from "@/lib/actions/emitentes";
import { Badge } from "@/components/ui/badge";
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
import { Toaster, toast } from "@/components/ui/toast";

type Categoria = CategoriaRow & { catalogoUrl: string | null };

export function CategoriasConfigClient({
  categorias,
  emitentes,
  emitenteInicial,
}: {
  categorias: Categoria[];
  /** Empresas em que o usuário é diretor. */
  emitentes: { id: string; nome: string }[];
  emitenteInicial: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [aberto, setAberto] = useState(false);
  const nomeEmpresa = (id: string) => emitentes.find((e) => e.id === id)?.nome ?? "—";

  return (
    <Toaster>
      <div className="flex flex-col gap-6">
        <div>
          <Button
            type="button"
            onClick={() => {
              setEditando(null);
              setAberto(true);
            }}
          >
            + Categoria
          </Button>
        </div>

        {aberto ? (
          <form
            key={editando?.id ?? "nova"}
            className="grid max-w-xl gap-3 rounded-xl border border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await salvarCategoria(editando?.id ?? null, {
                  emitente_id: String(fd.get("emitente_id") ?? ""),
                  nome: String(fd.get("nome") ?? ""),
                  descricao: String(fd.get("descricao") ?? "") || null,
                  catalogo_url: String(fd.get("catalogo_url") ?? "") || null,
                  ativo: fd.get("ativo") === "on",
                });
                if (!res.ok) {
                  toast.add({ title: res.error, type: "error" });
                  return;
                }
                toast.add({ title: "Categoria salva", type: "success" });
                setAberto(false);
                setEditando(null);
                router.refresh();
              });
            }}
          >
            <h2 className="font-medium">{editando ? "Editar categoria" : "Nova categoria"}</h2>
            <label className="text-sm">
              Empresa vendedora *
              <select
                name="emitente_id"
                required
                disabled={Boolean(editando)}
                defaultValue={editando?.emitente_id ?? emitenteInicial ?? emitentes[0]?.id ?? ""}
                className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {emitentes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Nome *
              <Input name="nome" required className="mt-1" defaultValue={editando?.nome ?? ""} />
            </label>
            <label className="text-sm">
              Descrição
              <Textarea name="descricao" rows={2} className="mt-1" defaultValue={editando?.descricao ?? ""} />
            </label>
            <label className="text-sm">
              Catálogo hospedado (URL)
              <Input name="catalogo_url" placeholder="https://" className="mt-1" defaultValue={editando?.catalogo_url ?? ""} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={editando?.ativo ?? true} />
              Ativa
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

        {editando ? (
          <form
            className="flex max-w-xl flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await uploadCatalogoCategoria(editando.id, editando.emitente_id, fd);
                if (!res.ok) {
                  toast.add({ title: res.error, type: "error" });
                  return;
                }
                toast.add({ title: "Catálogo anexado", type: "success" });
                router.refresh();
              });
            }}
          >
            <div className="w-full text-sm font-medium">Catálogo da categoria (arquivo PDF ou imagem, até 10 MB)</div>
            <Input name="catalogo" type="file" accept="application/pdf,image/*" required />
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
                    const res = await removerCatalogo("categoria", editando.id, editando.emitente_id);
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
              <TableHead>Categoria</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Catálogo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.nome}
                  {c.descricao ? (
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                  ) : null}
                </TableCell>
                <TableCell>{nomeEmpresa(c.emitente_id)}</TableCell>
                <TableCell>
                  {c.catalogoUrl ? (
                    <a
                      href={c.catalogoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
                    >
                      <ExternalLink className="size-3.5" />
                      {c.catalogo_path ? "arquivo" : "link"}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={c.ativo ? "secondary" : "outline"}>{c.ativo ? "Ativa" : "Inativa"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditando(c);
                      setAberto(true);
                    }}
                  >
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {categorias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Nenhuma categoria. Crie categorias para agrupar produtos e anexar um catálogo por grupo.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Toaster>
  );
}
