"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Search } from "lucide-react";

import {
  arquivarContato,
  atualizarContato,
  criarContato,
} from "@/lib/actions/contatos";
import {
  BarraFiltros,
  CampoFiltro,
  EstadoVazio,
  Secao,
  campoClass,
} from "@/components/crm/pagina";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ContatoListaRow = {
  id: string;
  empresaId: string;
  empresaNome: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  cargo: string | null;
  decisor: boolean;
  instagram: string | null;
  linkedin: string | null;
  podeEditar: boolean;
};

type EmpresaOption = { id: string; nome: string };

type Props = {
  contatos: ContatoListaRow[];
  empresas: EmpresaOption[];
};

const formVazio = {
  empresa_id: "",
  nome: "",
  whatsapp: "",
  email: "",
  cargo: "",
  decisor: false,
  instagram: "",
  linkedin: "",
};

export function ContatosLista({ contatos, empresas }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState(formVazio);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contatos;
    return contatos.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.empresaNome.toLowerCase().includes(q) ||
        (c.cargo ?? "").toLowerCase().includes(q) ||
        (c.whatsapp ?? "").includes(q),
    );
  }, [contatos, busca]);

  function abrirNovo() {
    setEditId(null);
    setErro(null);
    setForm({
      ...formVazio,
      empresa_id: empresas[0]?.id ?? "",
    });
    setOpen(true);
  }

  function abrirEditar(c: ContatoListaRow) {
    setEditId(c.id);
    setErro(null);
    setForm({
      empresa_id: c.empresaId,
      nome: c.nome,
      whatsapp: c.whatsapp ?? "",
      email: c.email ?? "",
      cargo: c.cargo ?? "",
      decisor: c.decisor,
      instagram: c.instagram ?? "",
      linkedin: c.linkedin ?? "",
    });
    setOpen(true);
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const payload = {
        empresa_id: form.empresa_id,
        nome: form.nome,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        cargo: form.cargo || null,
        decisor: form.decisor,
        instagram: form.instagram || null,
        linkedin: form.linkedin || null,
      };
      const res = editId
        ? await atualizarContato(editId, payload)
        : await criarContato(payload);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <BarraFiltros
        acoes={
          <Button
            type="button"
            className="rounded-full px-4 font-semibold"
            onClick={abrirNovo}
            disabled={empresas.length === 0}
          >
            <Plus className="size-4" />
            Novo contato
          </Button>
        }
      >
        <CampoFiltro
          id="busca-contatos"
          label="Busca"
          className="col-span-2 sm:col-span-2"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="busca-contatos"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome, empresa, cargo…"
              className={`${campoClass} pl-9`}
              aria-label="Buscar contatos"
            />
          </div>
        </CampoFiltro>
      </BarraFiltros>

      <Secao
        titulo="Contatos"
        meta={`${filtrados.length} ${filtrados.length === 1 ? "pessoa" : "pessoas"}`}
        semPadding
      >
        {filtrados.length === 0 ? (
          <EstadoVazio texto="Nenhum contato encontrado." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="hidden sm:table-cell">Cargo</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead className="w-16 text-center">Decisor</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>
                      <Link
                        href={`/empresas/${c.empresaId}`}
                        className="hover:underline"
                      >
                        {c.empresaNome}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {c.cargo ?? "—"}
                    </TableCell>
                    <TableCell>
                      {c.whatsapp ? (
                        <a
                          href={`https://wa.me/${c.whatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline-offset-2 hover:underline"
                        >
                          {c.whatsapp}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.decisor ? (
                        <Check
                          className="mx-auto size-4 text-success"
                          aria-label="Sim"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.podeEditar ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => abrirEditar(c)}
                            aria-label="Editar"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const res = await arquivarContato(c.id);
                                if (!res.ok) {
                                  setErro(res.error);
                                  return;
                                }
                                router.refresh();
                              })
                            }
                          >
                            Arquivar
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Secao>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar contato" : "Novo contato"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Empresa *
              </label>
              <select
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
                value={form.empresa_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, empresa_id: e.target.value }))
                }
              >
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nome *</label>
              <Input
                value={form.nome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nome: e.target.value }))
                }
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                WhatsApp (DDI+número)
              </label>
              <Input
                value={form.whatsapp}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    whatsapp: e.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="5531999998888"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cargo</label>
              <Input
                value={form.cargo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cargo: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Instagram</label>
              <Input
                value={form.instagram}
                placeholder="@usuario ou URL"
                onChange={(e) =>
                  setForm((f) => ({ ...f, instagram: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">LinkedIn</label>
              <Input
                value={form.linkedin}
                placeholder="URL do perfil"
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkedin: e.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.decisor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, decisor: e.target.checked }))
                }
              />
              Decisor
            </label>
            {erro ? (
              <p className="text-sm text-destructive" role="alert">
                {erro}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !form.nome.trim() || !form.empresa_id}
                onClick={salvar}
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
