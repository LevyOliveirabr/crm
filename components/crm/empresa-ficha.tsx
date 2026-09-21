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
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/format";
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
import { BotaoConsultarCnpj } from "@/components/crm/botao-consultar-cnpj";
import { InputCnpj } from "@/components/crm/input-cnpj";
import {
  EstadoVazio,
  Pagina,
  PaginaCabecalho,
  Secao,
  Tile,
  Tiles,
} from "@/components/crm/pagina";
import { cn } from "@/lib/utils";

export type EmpresaFichaData = {
  id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  segmento: string | null;
  tipoSegmento: "publico" | "privado" | "ppp" | null;
  cnpj: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  observacoes: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
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
  /** Empresa vendedora (só quando o escopo é "Todas"). */
  emitenteNome?: string | null;
};

export type ContatoEmpresaItem = {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  cargo: string | null;
  decisor: boolean;
  instagram: string | null;
  linkedin: string | null;
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
    instagram: "",
    linkedin: "",
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
        ...("tipoSegmento" in patch
          ? { tipo_segmento: next.tipoSegmento }
          : {}),
        cnpj: next.cnpj,
        responsavel_id: next.responsavelId,
        observacoes: next.observacoes,
        logradouro: next.logradouro,
        numero: next.numero,
        complemento: next.complemento,
        bairro: next.bairro,
        cep: next.cep,
        municipio: next.municipio,
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
      instagram: "",
      linkedin: "",
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
      instagram: c.instagram ?? "",
      linkedin: c.linkedin ?? "",
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
        instagram: contatoForm.instagram || null,
        linkedin: contatoForm.linkedin || null,
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
                  instagram: res.contato.instagram,
                  linkedin: res.contato.linkedin,
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
            instagram: res.contato.instagram,
            linkedin: res.contato.linkedin,
          },
        ]);
      }
    });
  }

  const inputDisabled = !podeEditar || pending;

  return (
    <Pagina largura="media" className="pb-20">
      <PaginaCabecalho
        voltar={{ href: "/empresas", label: "Empresas" }}
        titulo={
          <input
            className={cn(
              "w-full min-w-[12rem] bg-transparent font-heading text-2xl font-semibold tracking-tight outline-none sm:text-3xl",
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
        }
        descricao={
          <>
            {[e.cidade, e.uf].filter(Boolean).join(" / ") || "Sem cidade"}
            {e.segmento ? ` · ${e.segmento}` : ""}
            {e.responsavelNome ? ` · responsável ${e.responsavelNome}` : ""}
          </>
        }
        acoes={
          <>
            <Button
              type="button"
              size="lg"
              className="rounded-full px-4 font-semibold"
              onClick={() => setNovaNegOpen(true)}
            >
              <Plus className="size-4" />
              Nova negociação
            </Button>
            {podeEditar ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="rounded-full border-foreground/80 bg-card px-4 font-semibold"
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
          </>
        }
      />

      {!podeEditar ? (
        <p className="card-surface border-l-4 border-l-brand px-4 py-3 text-sm text-muted-foreground">
          Você pode ver esta empresa, mas só o responsável ou um diretor pode
          editar.
        </p>
      ) : null}

      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <Tiles colunas={4}>
        <Tile
          label="Aberto"
          valor={formatarMoeda(e.aberto)}
          detalhe={`${e.qtdNegociacoes} negociações no total`}
        />
        <Tile
          label="Vendido"
          valor={formatarMoeda(e.vendido)}
          tom="ok"
          detalhe={
            e.ticketMedio != null
              ? `ticket médio ${formatarMoeda(e.ticketMedio)}`
              : "sem vendas"
          }
        />
        <Tile
          label="Perdido"
          valor={formatarMoeda(e.perdido)}
          tom="ruim"
          detalhe={
            e.cicloMedioDias != null
              ? `ciclo médio ${Math.round(e.cicloMedioDias)} dias`
              : undefined
          }
        />
        <Tile
          label="Último contato"
          valor={e.ultimoContato ? formatarData(e.ultimoContato) : "Nunca"}
        />
      </Tiles>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Cadastro" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">
                Endereço (logradouro)
              </label>
              <Input
                value={e.logradouro ?? ""}
                disabled={inputDisabled}
                onChange={(ev) =>
                  setE((x) => ({ ...x, logradouro: ev.target.value || null }))
                }
                onBlur={() => salvarCadastro({ logradouro: e.logradouro })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Número
              </label>
              <Input
                value={e.numero ?? ""}
                disabled={inputDisabled}
                onChange={(ev) =>
                  setE((x) => ({ ...x, numero: ev.target.value || null }))
                }
                onBlur={() => salvarCadastro({ numero: e.numero })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Complemento
              </label>
              <Input
                value={e.complemento ?? ""}
                disabled={inputDisabled}
                onChange={(ev) =>
                  setE((x) => ({ ...x, complemento: ev.target.value || null }))
                }
                onBlur={() => salvarCadastro({ complemento: e.complemento })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Bairro
              </label>
              <Input
                value={e.bairro ?? ""}
                disabled={inputDisabled}
                onChange={(ev) =>
                  setE((x) => ({ ...x, bairro: ev.target.value || null }))
                }
                onBlur={() => salvarCadastro({ bairro: e.bairro })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                CEP
              </label>
              <Input
                value={e.cep ?? ""}
                disabled={inputDisabled}
                inputMode="numeric"
                placeholder="00000-000"
                onChange={(ev) => {
                  const d = ev.target.value.replace(/\D/g, "").slice(0, 8);
                  const fmt =
                    d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
                  setE((x) => ({ ...x, cep: fmt || null }));
                }}
                onBlur={() => salvarCadastro({ cep: e.cep })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Município
              </label>
              <Input
                value={e.municipio ?? e.cidade ?? ""}
                disabled={inputDisabled}
                onChange={(ev) =>
                  setE((x) => ({
                    ...x,
                    municipio: ev.target.value || null,
                    cidade: ev.target.value || null,
                  }))
                }
                onBlur={() =>
                  salvarCadastro({
                    municipio: e.municipio,
                    cidade: e.municipio ?? e.cidade,
                  })
                }
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
                Segmento (tipo de cliente)
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
              <label
                htmlFor="empresa-tipo-segmento"
                className="mb-1 block text-xs text-muted-foreground"
              >
                Tipo de cliente
              </label>
              <select
                id="empresa-tipo-segmento"
                value={e.tipoSegmento ?? ""}
                disabled={inputDisabled}
                onChange={(ev) => {
                  const v = (ev.target.value || null) as
                    | "publico"
                    | "privado"
                    | "ppp"
                    | null;
                  salvarCadastro({ tipoSegmento: v });
                }}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">—</option>
                <option value="publico">Público</option>
                <option value="privado">Privado</option>
                <option value="ppp">PPP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                CNPJ
              </label>
              <InputCnpj
                value={e.cnpj ?? ""}
                disabled={inputDisabled}
                onChange={(v) => setE((x) => ({ ...x, cnpj: v || null }))}
                onBlur={() => salvarCadastro({ cnpj: e.cnpj })}
              />
              <div className="mt-1.5">
                <BotaoConsultarCnpj
                  cnpj={e.cnpj ?? ""}
                  disabled={inputDisabled}
                  onDados={(d) => {
                    salvarCadastro({
                      cnpj: d.cnpj,
                      nome: e.nome.trim() ? e.nome : d.razaoSocial || e.nome,
                      cidade: e.cidade ?? d.cidade,
                      municipio: e.municipio ?? d.municipio ?? d.cidade,
                      uf: e.uf ?? d.uf,
                      logradouro: e.logradouro ?? d.logradouro,
                      numero: e.numero ?? d.numero,
                      complemento: e.complemento ?? d.complemento,
                      bairro: e.bairro ?? d.bairro,
                      cep: e.cep ?? d.cep,
                    });
                  }}
                />
              </div>
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
                    vendedores.find((v) => v.id === responsavelId)?.nome ??
                    null;
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
        </Secao>

        <Secao titulo="Negociações" meta={`${negociacoesOrdenadas.length}`}>
          {negociacoesOrdenadas.length === 0 ? (
            <EstadoVazio texto="Nenhuma negociação ainda." compacto />
          ) : (
            <ul className="divide-y divide-border">
              {negociacoesOrdenadas.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/negociacoes/${n.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.etapaNome ?? "—"}
                        {n.responsavelNome ? ` · ${n.responsavelNome}` : ""}
                        {n.emitenteNome ? ` · ${n.emitenteNome}` : ""}
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
        </Secao>

        <Secao
          titulo="Contatos"
          meta={`${contatos.length}`}
          acoes={
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
          }
        >
          {contatos.length === 0 ? (
            <EstadoVazio texto="Nenhum contato." compacto />
          ) : (
            <ul className="divide-y divide-border">
              {contatos.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {c.nome}
                      {c.decisor ? (
                        <Check
                          className="ml-1 inline size-3.5 text-success"
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
        </Secao>

        <Secao
          titulo="Linha do tempo"
          meta="interações, ações e orçamentos"
          className="lg:col-span-2"
        >
          {timeline.length === 0 ? (
            <EstadoVazio texto="Nada registrado ainda." compacto />
          ) : (
            <ul className="divide-y divide-border">
              {timeline.map((item) => {
                const Icon = iconeTimeline(item);
                return (
                  <li
                    key={`${item.kind}-${item.id}`}
                    className="flex gap-3 py-2.5 first:pt-0 last:pb-0"
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
        </Secao>
      </div>

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
            <div>
              <label className="mb-1 block text-sm font-medium">Instagram</label>
              <Input
                value={contatoForm.instagram}
                placeholder="@usuario ou URL"
                onChange={(ev) =>
                  setContatoForm((f) => ({ ...f, instagram: ev.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">LinkedIn</label>
              <Input
                value={contatoForm.linkedin}
                placeholder="URL do perfil"
                onChange={(ev) =>
                  setContatoForm((f) => ({ ...f, linkedin: ev.target.value }))
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
    </Pagina>
  );
}
