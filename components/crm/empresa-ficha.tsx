"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  FileText,
  MessageCircle,
  Phone,
  MapPin,
  Plus,
  StickyNote,
  Users,
} from "lucide-react";

import {
  atualizarEmpresa,
  arquivarEmpresa,
  type EmpresaResumo,
} from "@/lib/actions/empresas";
import {
  arquivarContato,
  atualizarContato,
  criarContato,
} from "@/lib/actions/contatos";
import type { DadosFormNegociacao } from "@/lib/actions/form-negociacao";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
} from "@/lib/format";
import { NovaNegociacaoForm } from "@/components/crm/nova-negociacao-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type EmpresaFichaData = {
  id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  segmento: string | null;
  cnpj: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  observacoes: string | null;
  aberto: number;
  vendido: number;
  perdido: number;
  qtdNegociacoes: number;
  ticketMedio: number | null;
  cicloMedioDias: number | null;
  ultimoContato: string | null;
};

export type NegociacaoEmpresaItem = {
  id: string;
  titulo: string;
  status: "aberta" | "vendida" | "perdida";
  valorEstimado: number;
  valorFinal: number | null;
  etapaNome: string | null;
  responsavelNome: string | null;
};

export type ContatoEmpresaItem = {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  cargo: string | null;
  decisor: boolean;
};

export type TimelineEmpresaItem =
  | {
      kind: "interacao";
      id: string;
      em: string;
      tipo: string;
      texto: string | null;
      negociacaoTitulo: string;
      negociacaoId: string;
    }
  | {
      kind: "acao";
      id: string;
      em: string;
      descricao: string;
      data: string;
      negociacaoTitulo: string;
      negociacaoId: string;
    }
  | {
      kind: "orcamento";
      id: string;
      em: string;
      valor: number;
      numero: string | null;
      situacao: string;
      negociacaoTitulo: string;
      negociacaoId: string;
    };

export type VendedorOption = { id: string; nome: string };

type Props = {
  empresa: EmpresaFichaData;
  negociacoes: NegociacaoEmpresaItem[];
  contatos: ContatoEmpresaItem[];
  timeline: TimelineEmpresaItem[];
  segmentos: string[];
  vendedores: VendedorOption[];
  podeEditar: boolean;
  dadosNova: DadosFormNegociacao;
};

function iconeTimeline(item: TimelineEmpresaItem) {
  if (item.kind === "orcamento") return FileText;
  if (item.kind === "acao") return CalendarClock;
  switch (item.tipo) {
    case "ligacao":
      return Phone;
    case "whatsapp":
      return MessageCircle;
    case "visita":
      return MapPin;
    case "reuniao":
      return Users;
    default:
      return StickyNote;
  }
}

function Indicador({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function EmpresaFicha({
  empresa: inicial,
  negociacoes,
  contatos: contatosIniciais,
  timeline,
  segmentos,
  vendedores,
  podeEditar,
  dadosNova,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [e, setE] = useState(inicial);
  const [contatos, setContatos] = useState(contatosIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [novaNegOpen, setNovaNegOpen] = useState(false);
  const [contatoOpen, setContatoOpen] = useState(false);
  const [contatoEditId, setContatoEditId] = useState<string | null>(null);
  const [contatoForm, setContatoForm] = useState({
    nome: "",
    whatsapp: "",
    email: "",
    cargo: "",
    decisor: false,
  });

  const empresaResumo: EmpresaResumo = useMemo(
    () => ({
      id: e.id,
      nome: e.nome,
      cidade: e.cidade,
      segmento: e.segmento,
    }),
    [e.id, e.nome, e.cidade, e.segmento],
  );

  const negociacoesOrdenadas = useMemo(() => {
    return [...negociacoes].sort((a, b) => {
      const aOpen = a.status === "aberta" ? 0 : 1;
      const bOpen = b.status === "aberta" ? 0 : 1;
      return aOpen - bOpen || a.titulo.localeCompare(b.titulo, "pt-BR");
    });
  }, [negociacoes]);

  function run(fn: () => Promise<void>) {
    setErro(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro inesperado.");
      }
    });
  }

  function salvarCadastro(patch: Partial<EmpresaFichaData>) {
    if (!podeEditar) {
      setErro("Sem permissão para editar esta empresa.");
      return;
    }
    const next = { ...e, ...patch };
    setE(next);
    run(async () => {
      const res = await atualizarEmpresa(e.id, {
        nome: next.nome,
        cidade: next.cidade,
        uf: next.uf,
        segmento: next.segmento,
        cnpj: next.cnpj,
        responsavel_id: next.responsavelId,
        observacoes: next.observacoes,
      });
      if (!res.ok) {
        setE(e);
        setErro(res.error);
      }
    });
  }

  function abrirNovoContato() {
    setContatoEditId(null);
    setContatoForm({
      nome: "",
      whatsapp: "",
      email: "",
      cargo: "",
      decisor: false,
    });
    setContatoOpen(true);
  }

  function abrirEditarContato(c: ContatoEmpresaItem) {
    setContatoEditId(c.id);
    setContatoForm({
      nome: c.nome,
      whatsapp: c.whatsapp ?? "",
      email: c.email ?? "",
      cargo: c.cargo ?? "",
      decisor: c.decisor,
    });
    setContatoOpen(true);
  }

  function salvarContato() {
    if (!podeEditar) {
      setErro("Sem permissão para editar contatos desta empresa.");
      return;
    }
    run(async () => {
      const payload = {
        empresa_id: e.id,
        nome: contatoForm.nome,
        whatsapp: contatoForm.whatsapp || null,
        email: contatoForm.email || null,
        cargo: contatoForm.cargo || null,
        decisor: contatoForm.decisor,
      };
      const res = contatoEditId
        ? await atualizarContato(contatoEditId, payload)
        : await criarContato(payload);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setContatoOpen(false);
      if (contatoEditId) {
        setContatos((list) =>
          list.map((c) =>
            c.id === contatoEditId
              ? {
                  id: res.contato.id,
                  nome: res.contato.nome,
                  whatsapp: res.contato.whatsapp,
                  email: res.contato.email,
                  cargo: res.contato.cargo,
                  decisor: res.contato.decisor,
                }
              : c,
          ),
        );
      } else {
        setContatos((list) => [
          ...list,
          {
            id: res.contato.id,
            nome: res.contato.nome,
            whatsapp: res.contato.whatsapp,
            email: res.contato.email,
            cargo: res.contato.cargo,
            decisor: res.contato.decisor,
          },
        ]);
      }
    });
  }

  const inputDisabled = !podeEditar || pending;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            className={cn(
              "w-full bg-transparent text-2xl font-semibold tracking-tight outline-none",
              !podeEditar && "cursor-default",
            )}
            value={e.nome}
            disabled={inputDisabled}
            onChange={(ev) => setE((x) => ({ ...x, nome: ev.target.value }))}
            onBlur={() => {
              if (e.nome.trim() && e.nome !== inicial.nome) {
                salvarCadastro({ nome: e.nome.trim() });
              }
            }}
            aria-label="Nome da empresa"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {[e.cidade, e.uf].filter(Boolean).join(" / ") || "Sem cidade"}
            {e.segmento ? ` · ${e.segmento}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setNovaNegOpen(true)}>
            <Plus className="size-4" />
            Negociação
          </Button>
          {podeEditar ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await arquivarEmpresa(e.id);
                  if (!res.ok) {
                    setErro(res.error);
                    return;
                  }
                  router.push("/empresas");
                })
              }
            >
              Arquivar
            </Button>
          ) : null}
        </div>
      </div>

      {!podeEditar ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Você pode ver esta empresa, mas só o responsável ou um diretor pode
          editar.
        </p>
      ) : null}

      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Indicador label="Aberto" value={formatarMoeda(e.aberto)} />
        <Indicador label="Vendido" value={formatarMoeda(e.vendido)} />
        <Indicador label="Perdido" value={formatarMoeda(e.perdido)} />
        <Indicador label="Negociações" value={String(e.qtdNegociacoes)} />
        <Indicador
          label="Ticket médio"
          value={
            e.ticketMedio != null ? formatarMoeda(e.ticketMedio) : "—"
          }
        />
        <Indicador
          label="Ciclo médio"
          value={
            e.cicloMedioDias != null
              ? `${Math.round(e.cicloMedioDias)} d`
              : "—"
          }
        />
        <Indicador
          label="Último contato"
          value={
            e.ultimoContato ? formatarData(e.ultimoContato) : "Nunca"
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Cadastro</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Cidade
            </label>
            <Input
              value={e.cidade ?? ""}
              disabled={inputDisabled}
              onChange={(ev) =>
                setE((x) => ({ ...x, cidade: ev.target.value || null }))
              }
              onBlur={() => salvarCadastro({ cidade: e.cidade })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              UF
            </label>
            <Input
              value={e.uf ?? ""}
              maxLength={2}
              disabled={inputDisabled}
              onChange={(ev) =>
                setE((x) => ({
                  ...x,
                  uf: ev.target.value.toUpperCase() || null,
                }))
              }
              onBlur={() => salvarCadastro({ uf: e.uf })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Segmento
            </label>
            <Input
              value={e.segmento ?? ""}
              list="segmentos-ficha"
              disabled={inputDisabled}
              onChange={(ev) =>
                setE((x) => ({ ...x, segmento: ev.target.value || null }))
              }
              onBlur={() => salvarCadastro({ segmento: e.segmento })}
            />
            <datalist id="segmentos-ficha">
              {segmentos.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              CNPJ
            </label>
            <Input
              value={e.cnpj ?? ""}
              disabled={inputDisabled}
              onChange={(ev) =>
                setE((x) => ({ ...x, cnpj: ev.target.value || null }))
              }
              onBlur={() => salvarCadastro({ cnpj: e.cnpj })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">
              Responsável
            </label>
            <select
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none disabled:opacity-50"
              value={e.responsavelId ?? ""}
              disabled={inputDisabled}
              onChange={(ev) => {
                const responsavelId = ev.target.value || null;
                const responsavelNome =
                  vendedores.find((v) => v.id === responsavelId)?.nome ?? null;
                salvarCadastro({ responsavelId, responsavelNome });
              }}
            >
              <option value="">Sem responsável</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">
              Observações
            </label>
            <Textarea
              value={e.observacoes ?? ""}
              disabled={inputDisabled}
              rows={3}
              onChange={(ev) =>
                setE((x) => ({ ...x, observacoes: ev.target.value || null }))
              }
              onBlur={() => salvarCadastro({ observacoes: e.observacoes })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Negociações</h2>
        {negociacoesOrdenadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma negociação ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {negociacoesOrdenadas.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/negociacoes/${n.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.etapaNome ?? "—"}
                      {n.responsavelNome ? ` · ${n.responsavelNome}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        n.status === "aberta"
                          ? "secondary"
                          : n.status === "vendida"
                            ? "default"
                            : "outline"
                      }
                    >
                      {n.status}
                    </Badge>
                    <span className="text-sm tabular-nums">
                      {formatarMoeda(
                        n.status === "vendida" && n.valorFinal != null
                          ? n.valorFinal
                          : n.valorEstimado,
                      )}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Contatos</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!podeEditar}
            onClick={abrirNovoContato}
          >
            <Plus className="size-4" />
            Contato
          </Button>
        </div>
        {contatos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contato.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {contatos.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {c.nome}
                    {c.decisor ? (
                      <Check
                        className="ml-1 inline size-3.5 text-green-600"
                        aria-label="Decisor"
                      />
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.cargo ?? "Sem cargo"}
                    {c.whatsapp ? (
                      <>
                        {" · "}
                        <a
                          href={`https://wa.me/${c.whatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground underline-offset-2 hover:underline"
                        >
                          WhatsApp
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                {podeEditar ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => abrirEditarContato(c)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const res = await arquivarContato(c.id);
                          if (!res.ok) {
                            setErro(res.error);
                            return;
                          }
                          setContatos((list) =>
                            list.filter((x) => x.id !== c.id),
                          );
                        })
                      }
                    >
                      Arquivar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada registrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {timeline.map((item) => {
              const Icon = iconeTimeline(item);
              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex gap-3 px-3 py-2.5"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      <Link
                        href={`/negociacoes/${item.negociacaoId}`}
                        className="hover:underline"
                      >
                        {item.negociacaoTitulo}
                      </Link>
                      {" · "}
                      {formatarDataHora(item.em)}
                    </p>
                    {item.kind === "interacao" ? (
                      <>
                        <p className="text-sm font-medium capitalize">
                          {item.tipo}
                        </p>
                        {item.texto ? (
                          <p className="text-sm text-muted-foreground">
                            {item.texto}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    {item.kind === "acao" ? (
                      <p className="text-sm">
                        <span className="font-medium">Ação concluída:</span>{" "}
                        {item.descricao}{" "}
                        <span className="text-muted-foreground">
                          ({formatarData(item.data)})
                        </span>
                      </p>
                    ) : null}
                    {item.kind === "orcamento" ? (
                      <p className="text-sm">
                        <span className="font-medium">
                          Orçamento
                          {item.numero ? ` ${item.numero}` : ""}
                        </span>
                        {" · "}
                        {formatarMoeda(item.valor)}
                        <span className="text-muted-foreground">
                          {" "}
                          · {item.situacao}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={novaNegOpen} onOpenChange={setNovaNegOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova negociação</DialogTitle>
          </DialogHeader>
          <NovaNegociacaoForm
            dados={dadosNova}
            empresaInicial={empresaResumo}
            onCancelar={() => setNovaNegOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={contatoOpen} onOpenChange={setContatoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {contatoEditId ? "Editar contato" : "Novo contato"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Nome *</label>
              <Input
                value={contatoForm.nome}
                onChange={(ev) =>
                  setContatoForm((f) => ({ ...f, nome: ev.target.value }))
                }
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                WhatsApp (DDI+número)
              </label>
              <Input
                value={contatoForm.whatsapp}
                onChange={(ev) =>
                  setContatoForm((f) => ({
                    ...f,
                    whatsapp: ev.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="5531999998888"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <Input
                type="email"
                value={contatoForm.email}
                onChange={(ev) =>
                  setContatoForm((f) => ({ ...f, email: ev.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cargo</label>
              <Input
                value={contatoForm.cargo}
                onChange={(ev) =>
                  setContatoForm((f) => ({ ...f, cargo: ev.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={contatoForm.decisor}
                onChange={(ev) =>
                  setContatoForm((f) => ({
                    ...f,
                    decisor: ev.target.checked,
                  }))
                }
              />
              Decisor
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setContatoOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !contatoForm.nome.trim()}
                onClick={salvarContato}
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
