"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search } from "lucide-react";

import { criarEmpresa } from "@/lib/actions/empresas";
import { formatarData } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BotaoConsultarCnpj } from "@/components/crm/botao-consultar-cnpj";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type EmpresaListaRow = {
  id: string;
  nome: string;
  cidade: string | null;
  segmento: string | null;
  responsavelNome: string | null;
  qtdAbertas: number;
  ultimoContato: string | null;
};

type SortKey =
  | "nome"
  | "cidade"
  | "segmento"
  | "responsavelNome"
  | "qtdAbertas"
  | "ultimoContato";

type Props = {
  empresas: EmpresaListaRow[];
  segmentos: string[];
  buscaInicial?: string;
};

function SortHead({
  label,
  column,
  className,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  column: SortKey;
  className?: string;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const ativo = sortKey === column;
  const Icon = !ativo ? ArrowUpDown : sortAsc ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      >
        {label}
        <Icon className="size-3.5 opacity-60" aria-hidden />
      </button>
    </TableHead>
  );
}

export function EmpresasLista({
  empresas,
  segmentos,
  buscaInicial = "",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busca, setBusca] = useState(buscaInicial);
  const [sortKey, setSortKey] = useState<SortKey>("ultimoContato");
  const [sortAsc, setSortAsc] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cidade: "",
    uf: "",
    segmento: "",
    cnpj: "",
    observacoes: "",
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      // Último contato: ASC com nulos primeiro (abandonadas)
      setSortAsc(key === "ultimoContato" || key === "nome" || key === "cidade");
    }
  }

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? empresas.filter((e) => e.nome.toLowerCase().includes(q))
      : empresas;

    const copy = [...base];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) {
        // nulls first on ASC (default último contato), last on DESC
        cmp = sortAsc ? -1 : 1;
      } else if (bv == null) {
        cmp = sortAsc ? 1 : -1;
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), "pt-BR");
      }
      // For nulls we already applied sortAsc direction above
      if (av == null || bv == null) return cmp;
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [empresas, busca, sortKey, sortAsc]);

  function salvarNova() {
    setErro(null);
    startTransition(async () => {
      const res = await criarEmpresa({
        nome: form.nome,
        cidade: form.cidade || null,
        uf: form.uf || null,
        segmento: form.segmento || null,
        cnpj: form.cnpj || null,
        observacoes: form.observacoes || null,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setDialogOpen(false);
      setForm({
        nome: "",
        cidade: "",
        uf: "",
        segmento: "",
        cnpj: "",
        observacoes: "",
      });
      router.push(`/empresas/${res.empresa.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome…"
            className="pl-9"
            aria-label="Buscar empresas"
          />
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Empresa
        </Button>
      </div>

      {filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma empresa encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead
                  label="Nome"
                  column="nome"
                  sortKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                />
                <SortHead
                  label="Cidade"
                  column="cidade"
                  className="hidden md:table-cell"
                  sortKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                />
                <SortHead
                  label="Segmento"
                  column="segmento"
                  className="hidden lg:table-cell"
                  sortKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                />
                <SortHead
                  label="Responsável"
                  column="responsavelNome"
                  className="hidden sm:table-cell"
                  sortKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                />
                <SortHead
                  label="Abertas"
                  column="qtdAbertas"
                  sortKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                />
                <SortHead
                  label="Último contato"
                  column="ultimoContato"
                  sortKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      href={`/empresas/${e.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {e.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {e.cidade ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {e.segmento ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {e.responsavelNome ?? "—"}
                  </TableCell>
                  <TableCell>{e.qtdAbertas}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.ultimoContato
                      ? formatarData(e.ultimoContato)
                      : "Nunca"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Cidade</label>
                <Input
                  value={form.cidade}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cidade: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">UF</label>
                <Input
                  value={form.uf}
                  maxLength={2}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      uf: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Segmento</label>
              <Input
                value={form.segmento}
                list="segmentos-empresa"
                onChange={(e) =>
                  setForm((f) => ({ ...f, segmento: e.target.value }))
                }
              />
              <datalist id="segmentos-empresa">
                {segmentos.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">CNPJ</label>
              <Input
                value={form.cnpj}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cnpj: e.target.value }))
                }
              />
              <div className="mt-1.5">
                <BotaoConsultarCnpj
                  cnpj={form.cnpj}
                  onDados={(d) =>
                    setForm((f) => ({
                      ...f,
                      cnpj: d.cnpj,
                      nome: f.nome.trim() ? f.nome : d.razaoSocial,
                      cidade: f.cidade.trim() ? f.cidade : (d.cidade ?? ""),
                      uf: f.uf.trim() ? f.uf : (d.uf ?? ""),
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Observações
              </label>
              <Textarea
                value={form.observacoes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, observacoes: e.target.value }))
                }
                rows={3}
              />
            </div>
            {erro ? (
              <p className="text-sm text-destructive" role="alert">
                {erro}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !form.nome.trim()}
                onClick={salvarNova}
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
