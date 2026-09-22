"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  StickyNote,
  Users,
  Archive,
  Trash2,
} from "lucide-react";

import {
  adiarAcao,
  atualizarAcao,
  concluirAcao,
  criarAcao,
} from "@/lib/actions/acoes";
import { criarContato } from "@/lib/actions/contatos";
import { registrarInteracao } from "@/lib/actions/interacoes";
import {
  atualizarCampo,
  arquivar,
  excluirNegociacao,
  marcarPerda,
  marcarVenda,
  moverEtapa,
  reabrir,
} from "@/lib/actions/negociacoes";
import {
  criarOrcamentoGerado,
  criarOrcamentoUpload,
} from "@/lib/actions/orcamentos";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  hojeISO,
  inicioMesAtualISO,
  mesPorExtenso,
  parseMoedaBR,
} from "@/lib/format";
import type { Database } from "@/lib/database.types";
import { MiniFormProximaAcao } from "@/components/crm/mini-form-proxima-acao";
import {
  NegociacaoComplementos,
  type ParcelaFicha,
} from "@/components/crm/negociacao-complementos";
import {
  EstadoVazio,
  Pagina,
  PaginaCabecalho,
  Secao,
} from "@/components/crm/pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type StatusNeg = Database["public"]["Enums"]["status_negociacao"];
type TipoInteracao = Database["public"]["Enums"]["tipo_interacao"];
type TipoAcao = Database["public"]["Enums"]["tipo_acao"];
type SituacaoOrc = Database["public"]["Enums"]["situacao_orcamento"];

export type NegociacaoFichaData = {
  id: string;
  titulo: string;
  empresaId: string;
  empresaNome: string;
  emitenteId: string | null;
  emitenteNome: string | null;
  valorEstimado: number;
  valorPrevisao: number | null;
  negocioUnico: boolean;
  temperatura: number;
  responsavelId: string;
  responsavelNome: string;
  linha: string | null;
  origem: string | null;
  previsaoMes: string | null;
  previsaoData: string | null;
  dataFaturamento: string | null;
  categoriaForecast: "compromisso" | "provavel" | "possivel" | null;
  status: StatusNeg;
  valorFinal: number | null;
  motivoPerda: string | null;
  anotacaoFechamento: string | null;
  fechadoEm: string | null;
  etapaId: string;
  funilId: string;
  contatoId: string | null;
};

export type EtapaBarra = {
  id: string;
  nome: string;
  ordem: number;
};

export type ContatoFicha = {
  id: string;
  nome: string;
  whatsapp: string | null;
  cargo: string | null;
};

export type AcaoFicha = {
  id: string;
  descricao: string;
  tipo: TipoAcao;
  data: string;
  concluidaEm: string | null;
  criadoEm: string;
};

export type InteracaoFicha = {
  id: string;
  tipo: TipoInteracao;
  texto: string | null;
  criadoEm: string;
  usuarioNome: string | null;
};

export type OrcamentoFicha = {
  id: string;
  numero: string | null;
  valor: number;
  enviadoEm: string;
  validade: string | null;
  situacao: SituacaoOrc;
  origem: string;
  criadoEm: string;
  arquivoPath: string | null;
  aceitoEm: string | null;
};

export type VendedorOption = { id: string; nome: string };

type TimelineItem =
  | {
      kind: "interacao";
      id: string;
      em: string;
      tipo: TipoInteracao;
      texto: string | null;
      usuarioNome: string | null;
    }
  | {
      kind: "acao";
      id: string;
      em: string;
      descricao: string;
      tipo: TipoAcao;
      data: string;
    }
  | {
      kind: "orcamento";
      id: string;
      em: string;
      valor: number;
      numero: string | null;
      situacao: SituacaoOrc;
    };

const TEMP_LABEL: Record<number, string> = {
  1: "Fria",
  2: "Morna",
  3: "Quente",
};

const INTERACAO_BTN: {
  tipo: TipoInteracao;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { tipo: "ligacao", label: "Liguei", icon: Phone },
  { tipo: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { tipo: "visita", label: "Visitei", icon: MapPin },
  { tipo: "reuniao", label: "Reunião", icon: Users },
  { tipo: "anotacao", label: "Anotação", icon: StickyNote },
];

function iconeTimeline(item: TimelineItem) {
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
    case "anotacao":
      return StickyNote;
    default:
      return StickyNote;
  }
}

export function NegociacaoFicha({
  negociacao: inicial,
  etapas,
  proximaAcao,
  acoesConcluidas,
  interacoes,
  orcamentos,
  contatos,
  linhas,
  origens,
  motivosPerda,
  vendedores,
  isDiretor,
  faturado = false,
  valorFaturado = null,
  faturadoEm = null,
  parcelas = [],
}: {
  negociacao: NegociacaoFichaData;
  etapas: EtapaBarra[];
  proximaAcao: AcaoFicha | null;
  acoesConcluidas: AcaoFicha[];
  interacoes: InteracaoFicha[];
  orcamentos: OrcamentoFicha[];
  contatos: ContatoFicha[];
  linhas: string[];
  origens: string[];
  motivosPerda: string[];
  vendedores: VendedorOption[];
  isDiretor: boolean;
  faturado?: boolean;
  valorFaturado?: number | null;
  faturadoEm?: string | null;
  parcelas?: ParcelaFicha[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [n, setN] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);

  const [tituloLocal, setTituloLocal] = useState(inicial.titulo);
  const [valorLocal, setValorLocal] = useState(
    formatarMoeda(inicial.valorEstimado).replace(/^R\$\s?/, ""),
  );
  const [valorPrevisaoLocal, setValorPrevisaoLocal] = useState(
    inicial.valorPrevisao != null
      ? formatarMoeda(inicial.valorPrevisao).replace(/^R\$\s?/, "")
      : "",
  );

  const [rapidoTipo, setRapidoTipo] = useState<TipoInteracao | null>(null);
  const [rapidoTexto, setRapidoTexto] = useState("");

  const [vendaOpen, setVendaOpen] = useState(false);
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [orcOpen, setOrcOpen] = useState(false);
  const [editarAcaoOpen, setEditarAcaoOpen] = useState(false);
  const [novaAcaoOpen, setNovaAcaoOpen] = useState(false);
  const [contatoNovoOpen, setContatoNovoOpen] = useState(false);
  const [miniOpen, setMiniOpen] = useState(false);

  const [vendaValor, setVendaValor] = useState(String(inicial.valorEstimado));
  const [vendaMes, setVendaMes] = useState(() =>
    inicioMesAtualISO().slice(0, 7),
  );
  const [perdaMotivo, setPerdaMotivo] = useState("");
  const [perdaAnotacao, setPerdaAnotacao] = useState("");

  const [orcValor, setOrcValor] = useState("");
  const [orcEnvio, setOrcEnvio] = useState(hojeISO());
  const [orcValidade, setOrcValidade] = useState("");
  const [orcArquivo, setOrcArquivo] = useState<File | null>(null);
  const [orcAtualizarValor, setOrcAtualizarValor] = useState(true);

  const [acaoEdit, setAcaoEdit] = useState({
    descricao: "",
    data: hojeISO(),
  });
  const [contatoNovo, setContatoNovo] = useState({
    nome: "",
    whatsapp: "",
    cargo: "",
  });

  const aberta = n.status === "aberta";

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const i of interacoes) {
      items.push({
        kind: "interacao",
        id: i.id,
        em: i.criadoEm,
        tipo: i.tipo,
        texto: i.texto,
        usuarioNome: i.usuarioNome,
      });
    }
    for (const a of acoesConcluidas) {
      items.push({
        kind: "acao",
        id: a.id,
        em: a.concluidaEm ?? a.criadoEm,
        descricao: a.descricao,
        tipo: a.tipo,
        data: a.data,
      });
    }
    for (const o of orcamentos) {
      items.push({
        kind: "orcamento",
        id: o.id,
        em: o.criadoEm,
        valor: o.valor,
        numero: o.numero,
        situacao: o.situacao,
      });
    }
    items.sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : 0));
    return items;
  }, [interacoes, acoesConcluidas, orcamentos]);

  const contato = contatos.find((c) => c.id === n.contatoId) ?? null;

  function run(fn: () => Promise<void>) {
    setErro(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado.");
      }
    });
  }

  function salvarCampo(
    campo: Parameters<typeof atualizarCampo>[1],
    valor: unknown,
    otimista?: (prev: NegociacaoFichaData) => NegociacaoFichaData,
  ) {
    if (otimista) setN(otimista);
    run(async () => {
      const res = await atualizarCampo(n.id, campo, valor);
      if (!res.ok) {
        setN(inicial);
        setErro(res.error);
      }
    });
  }

  function onBlurTitulo() {
    const t = tituloLocal.trim();
    if (!t || t === n.titulo) {
      setTituloLocal(n.titulo);
      return;
    }
    salvarCampo("titulo", t, (p) => ({ ...p, titulo: t }));
  }

  function onBlurValor() {
    const parsed = parseMoedaBR(valorLocal);
    if (parsed == null) {
      setValorLocal(formatarMoeda(n.valorEstimado).replace(/^R\$\s?/, ""));
      return;
    }
    if (parsed === n.valorEstimado) return;
    salvarCampo("valor_estimado", parsed, (p) => ({
      ...p,
      valorEstimado: parsed,
    }));
  }

  function onBlurValorPrevisao() {
    const texto = valorPrevisaoLocal.trim();
    if (!texto) {
      if (n.valorPrevisao == null) return;
      setValorPrevisaoLocal("");
      salvarCampo("valor_previsao", null, (p) => ({
        ...p,
        valorPrevisao: null,
      }));
      return;
    }
    const parsed = parseMoedaBR(texto);
    if (parsed == null) {
      setValorPrevisaoLocal(
        n.valorPrevisao != null
          ? formatarMoeda(n.valorPrevisao).replace(/^R\$\s?/, "")
          : "",
      );
      return;
    }
    if (parsed === n.valorPrevisao) return;
    salvarCampo("valor_previsao", parsed, (p) => ({
      ...p,
      valorPrevisao: parsed,
    }));
  }

  const etapaAtualNome = etapas.find((et) => et.id === n.etapaId)?.nome ?? "—";

  return (
    <Pagina largura="media" className="pb-20">
      <PaginaCabecalho
        voltar={{ href: "/funil", label: "Funil" }}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            <Input
              value={tituloLocal}
              onChange={(e) => setTituloLocal(e.target.value)}
              onBlur={onBlurTitulo}
              disabled={pending || !aberta}
              className="h-auto min-w-[14rem] border-transparent bg-transparent px-0 font-heading text-2xl font-semibold tracking-tight shadow-none focus-visible:border-input focus-visible:bg-card focus-visible:px-2.5 sm:text-3xl"
              aria-label="Título"
            />
            {!aberta ? (
              <Badge
                variant={n.status === "vendida" ? "default" : "destructive"}
              >
                {n.status === "vendida" ? "Vendida" : "Perdida"}
              </Badge>
            ) : null}
          </span>
        }
        descricao={
          <span className="flex flex-wrap items-center gap-x-1.5">
            <Link
              href={`/empresas/${n.empresaId}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {n.empresaNome}
            </Link>
            {n.emitenteNome ? (
              <span>· vendido por {n.emitenteNome}</span>
            ) : null}
            <span>· etapa {etapaAtualNome}</span>
            <span>· {n.responsavelNome}</span>
          </span>
        }
        acoes={
          <>
            {aberta ? (
              <>
                <Button
                  type="button"
                  size="lg"
                  className="rounded-full px-4 font-semibold"
                  disabled={pending}
                  onClick={() => {
                    setVendaValor(String(n.valorEstimado));
                    setVendaMes(inicioMesAtualISO().slice(0, 7));
                    setVendaOpen(true);
                  }}
                >
                  Marcar venda
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="destructive"
                  className="rounded-full px-4 font-semibold"
                  disabled={pending}
                  onClick={() => {
                    setPerdaMotivo("");
                    setPerdaAnotacao("");
                    setPerdaOpen(true);
                  }}
                >
                  Marcar perda
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="rounded-full border-foreground/80 bg-card px-4 font-semibold"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await reabrir(n.id);
                    if (!res.ok) setErro(res.error);
                    else
                      setN((p) => ({
                        ...p,
                        status: "aberta",
                        fechadoEm: null,
                      }));
                  })
                }
              >
                Reabrir
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await arquivar(n.id);
                  if (!res.ok) setErro(res.error);
                  else router.push("/funil");
                })
              }
            >
              <Archive className="size-4" />
              Arquivar
            </Button>
            {isDiretor ? (
              <Button
                type="button"
                size="lg"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() => setExcluirOpen(true)}
              >
                <Trash2 className="size-4" />
                Excluir
              </Button>
            ) : null}
          </>
        }
      />

      {/* Etapas do funil */}
      <Secao titulo="Etapa" meta="clique para mover">
        <nav
          aria-label="Etapas do funil"
          className="flex gap-1 overflow-x-auto pb-1"
        >
          {etapas.map((et, idx) => {
            const ativa = et.id === n.etapaId;
            return (
              <button
                key={et.id}
                type="button"
                disabled={pending || !aberta}
                onClick={() => {
                  if (et.id === n.etapaId) return;
                  run(async () => {
                    const res = await moverEtapa(n.id, et.id);
                    if (!res.ok) {
                      setErro(res.error);
                      return;
                    }
                    setN((p) => ({ ...p, etapaId: et.id }));
                    if (res.precisaProximaAcao) setMiniOpen(true);
                  });
                }}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  ativa
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="mr-1 opacity-60">{idx + 1}.</span>
                {et.nome}
              </button>
            );
          })}
        </nav>
      </Secao>

      {!aberta && n.status === "perdida" && n.motivoPerda ? (
        <p className="text-sm text-muted-foreground">
          Motivo: {n.motivoPerda}
          {n.anotacaoFechamento ? ` — ${n.anotacaoFechamento}` : ""}
        </p>
      ) : null}
      {!aberta && n.status === "vendida" ? (
        <p className="text-sm text-muted-foreground">
          Valor final {formatarMoeda(n.valorFinal)}
          {n.fechadoEm ? ` · ${formatarDataHora(n.fechadoEm)}` : ""}
          {n.previsaoMes ? ` · ${mesPorExtenso(n.previsaoMes)}` : ""}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Próxima ação */}
          <Secao
            titulo="Próxima ação"
            destaque={Boolean(proximaAcao && proximaAcao.data < hojeISO())}
            acoes={
              aberta ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setNovaAcaoOpen(true)}
                >
                  <Plus className="size-3.5" />
                  Nova ação
                </Button>
              ) : undefined
            }
          >
            {proximaAcao ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{proximaAcao.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {formatarData(proximaAcao.data)}
                  {proximaAcao.data < hojeISO() ? (
                    <span className="ml-1.5 text-destructive">atrasada</span>
                  ) : null}
                </p>
                {aberta ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const res = await concluirAcao(proximaAcao.id);
                          if (!res.ok) {
                            setErro(res.error);
                            return;
                          }
                          if (res.precisaProximaAcao) setMiniOpen(true);
                        })
                      }
                    >
                      <Check className="size-3.5" />
                      Concluir
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const res = await adiarAcao(proximaAcao.id, 1);
                          if (!res.ok) setErro(res.error);
                        })
                      }
                    >
                      Adiar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        setAcaoEdit({
                          descricao: proximaAcao.descricao,
                          data: proximaAcao.data,
                        });
                        setEditarAcaoOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <EstadoVazio
                texto="Nenhuma ação pendente. Toda negociação aberta deveria ter um próximo passo."
                compacto
              />
            )}
          </Secao>

          {/* Registro rápido */}
          {aberta ? (
            <Secao
              titulo="Registrar interação"
              meta="um toque para gravar na linha do tempo"
            >
              <div className="flex flex-wrap gap-1.5">
                {INTERACAO_BTN.map(({ tipo, label, icon: Icon }) => (
                  <Button
                    key={tipo}
                    type="button"
                    size="sm"
                    variant={rapidoTipo === tipo ? "default" : "outline"}
                    disabled={pending}
                    onClick={() =>
                      setRapidoTipo((t) => (t === tipo ? null : tipo))
                    }
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </Button>
                ))}
              </div>
              {rapidoTipo ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Textarea
                    value={rapidoTexto}
                    onChange={(e) => setRapidoTexto(e.target.value)}
                    placeholder="Texto opcional…"
                    rows={2}
                    className="flex-1"
                    disabled={pending}
                  />
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const res = await registrarInteracao(
                          n.id,
                          rapidoTipo,
                          rapidoTexto.trim() || null,
                        );
                        if (!res.ok) {
                          setErro(res.error);
                          return;
                        }
                        setRapidoTipo(null);
                        setRapidoTexto("");
                      })
                    }
                  >
                    Salvar
                  </Button>
                </div>
              ) : null}
            </Secao>
          ) : null}

          {/* Timeline */}
          <Secao titulo="Linha do tempo" meta={`${timeline.length} registros`}>
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
                        {item.kind === "interacao" ? (
                          <>
                            <p className="text-sm font-medium capitalize">
                              {item.tipo}
                              {item.usuarioNome ? ` · ${item.usuarioNome}` : ""}
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
                            {item.descricao}
                            <span className="text-muted-foreground">
                              {" "}
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
                        <p className="text-[11px] text-muted-foreground">
                          {formatarDataHora(item.em)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Secao>

          {erro ? (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : null}
        </div>

        {/* Lateral */}
        <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-4">
          <Secao titulo="Dados">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="eyebrow">Valor potencial</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    value={valorLocal}
                    onChange={(e) => setValorLocal(e.target.value)}
                    onBlur={onBlurValor}
                    disabled={pending || !aberta}
                    className="h-8 w-36 tabular-nums"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="eyebrow">Valor previsão</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    value={valorPrevisaoLocal}
                    onChange={(e) => setValorPrevisaoLocal(e.target.value)}
                    onBlur={onBlurValorPrevisao}
                    disabled={pending || !aberta}
                    className="h-8 w-36 tabular-nums"
                    inputMode="decimal"
                    placeholder="= potencial"
                  />
                </div>
              </div>

              <div className="col-span-2 flex min-w-0 items-center gap-2">
                <input
                  id="negocio-unico"
                  type="checkbox"
                  checked={n.negocioUnico}
                  disabled={pending || !aberta}
                  onChange={(e) =>
                    salvarCampo("negocio_unico", e.target.checked, (p) => ({
                      ...p,
                      negocioUnico: e.target.checked,
                    }))
                  }
                  className="size-4 rounded border-input"
                />
                <label htmlFor="negocio-unico" className="text-sm font-medium">
                  Negócio único
                  <span className="ml-1 font-normal text-muted-foreground">
                    (desmarque se for recorrente)
                  </span>
                </label>
              </div>

              <NegociacaoComplementos
                negociacaoId={n.id}
                status={n.status}
                valorFinal={n.valorFinal}
                faturado={faturado}
                valorFaturado={valorFaturado}
                faturadoEm={faturadoEm}
                parcelas={parcelas}
              />

              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="eyebrow">Temperatura</span>
                <div className="flex gap-1">
                  {([1, 2, 3] as const).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      size="xs"
                      variant={n.temperatura === t ? "default" : "outline"}
                      disabled={pending || !aberta}
                      onClick={() =>
                        salvarCampo("temperatura", t, (p) => ({
                          ...p,
                          temperatura: t,
                        }))
                      }
                    >
                      {TEMP_LABEL[t]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="eyebrow">Responsável</span>
                {isDiretor && aberta ? (
                  <select
                    value={n.responsavelId}
                    disabled={pending}
                    onChange={(e) =>
                      salvarCampo("responsavel_id", e.target.value, (p) => ({
                        ...p,
                        responsavelId: e.target.value,
                        responsavelNome:
                          vendedores.find((v) => v.id === e.target.value)
                            ?.nome ?? p.responsavelNome,
                      }))
                    }
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  >
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm">{n.responsavelNome}</span>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="eyebrow">Linha</span>
                <select
                  value={n.linha ?? ""}
                  disabled={pending || !aberta}
                  onChange={(e) =>
                    salvarCampo("linha", e.target.value || null, (p) => ({
                      ...p,
                      linha: e.target.value || null,
                    }))
                  }
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  {linhas.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="eyebrow">Origem</span>
                <select
                  value={n.origem ?? ""}
                  disabled={pending || !aberta}
                  onChange={(e) =>
                    salvarCampo("origem", e.target.value || null, (p) => ({
                      ...p,
                      origem: e.target.value || null,
                    }))
                  }
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  {origens.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="eyebrow">
                  Fechamento previsto
                  {!n.previsaoData && n.previsaoMes ? (
                    <span className="ml-1 opacity-70">
                      ({mesPorExtenso(n.previsaoMes)})
                    </span>
                  ) : null}
                </span>
                <Input
                  type="date"
                  value={n.previsaoData ?? ""}
                  disabled={pending || !aberta}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    salvarCampo("previsao_data", v, (p) => ({
                      ...p,
                      previsaoData: v,
                      previsaoMes: v ? `${v.slice(0, 7)}-01` : p.previsaoMes,
                    }));
                  }}
                  className="h-8 w-40"
                />
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="eyebrow">Forecast</span>
                <select
                  value={n.categoriaForecast ?? ""}
                  disabled={pending || !aberta}
                  onChange={(e) => {
                    const v = (e.target.value || null) as
                      | "compromisso"
                      | "provavel"
                      | "possivel"
                      | null;
                    salvarCampo("categoria_forecast", v, (p) => ({
                      ...p,
                      categoriaForecast: v,
                    }));
                  }}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="compromisso">Compromisso</option>
                  <option value="provavel">Provável</option>
                  <option value="possivel">Possível</option>
                </select>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="eyebrow">Faturamento</span>
                <Input
                  type="date"
                  value={n.dataFaturamento ?? ""}
                  disabled={pending || !aberta}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    salvarCampo("data_faturamento", v, (p) => ({
                      ...p,
                      dataFaturamento: v,
                    }));
                  }}
                  className="h-8 w-40"
                />
              </div>
            </div>
          </Secao>

          <Secao
            titulo="Contato"
            acoes={
              aberta ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setContatoNovoOpen(true)}
                >
                  <Plus className="size-3.5" />
                  Contato
                </Button>
              ) : undefined
            }
          >
            {contato ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{contato.nome}</p>
                {contato.cargo ? (
                  <p className="text-xs text-muted-foreground">
                    {contato.cargo}
                  </p>
                ) : null}
                {contato.whatsapp ? (
                  <button
                    type="button"
                    disabled={pending}
                    title="Abre a conversa e registra a interação na timeline"
                    onClick={() => {
                      const url = `https://wa.me/${contato.whatsapp}`;
                      const janela = window.open(
                        url,
                        "_blank",
                        "noopener,noreferrer",
                      );
                      if (!janela) window.location.href = url;
                      if (!aberta) return;
                      run(async () => {
                        const res = await registrarInteracao(
                          n.id,
                          "whatsapp",
                          `Conversa pelo WhatsApp com ${contato.nome}`,
                        );
                        if (!res.ok) setErro(res.error);
                      });
                    }}
                    className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
                  >
                    <MessageCircle className="size-3.5" />
                    WhatsApp
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem contato vinculado.
              </p>
            )}
            {aberta && contatos.length > 0 ? (
              <select
                className="mt-2 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                value={n.contatoId ?? ""}
                disabled={pending}
                onChange={(e) =>
                  salvarCampo("contato_id", e.target.value || null, (p) => ({
                    ...p,
                    contatoId: e.target.value || null,
                  }))
                }
              >
                <option value="">— Selecionar —</option>
                {contatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            ) : null}
          </Secao>

          <Secao
            titulo="Orçamentos"
            meta={orcamentos.length > 0 ? `${orcamentos.length}` : undefined}
            acoes={
              aberta ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setOrcValor(String(n.valorEstimado));
                    setOrcEnvio(hojeISO());
                    setOrcValidade("");
                    setOrcArquivo(null);
                    setOrcAtualizarValor(true);
                    setOrcOpen(true);
                  }}
                >
                  <Plus className="size-3.5" />
                  Orçamento
                </Button>
              ) : undefined
            }
          >
            {orcamentos.length === 0 ? (
              <EstadoVazio texto="Nenhum orçamento." compacto />
            ) : (
              <ul className="space-y-2">
                {orcamentos.map((o) => (
                  <li key={o.id} className="text-sm">
                    <Link
                      href={`/orcamentos/${o.id}`}
                      className="font-medium hover:underline"
                    >
                      {o.numero ? `Orçamento ${o.numero}` : "Orçamento"} ·{" "}
                      {formatarMoeda(o.valor)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatarData(o.enviadoEm)} · {o.situacao}
                      {o.validade ? ` · val. ${formatarData(o.validade)}` : ""}
                      {o.aceitoEm ? (
                        <span className="ml-1 font-semibold text-success">
                          · aceito pelo cliente
                        </span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </aside>
      </div>

      {/* Dialogs */}
      <Dialog open={vendaOpen} onOpenChange={setVendaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar venda</DialogTitle>
            <DialogDescription>
              Informe o valor final e o mês da venda.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Valor final *</label>
              <Input
                value={vendaValor}
                onChange={(e) => setVendaValor(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Mês da venda</label>
              <Input
                type="month"
                value={vendaMes}
                onChange={(e) => setVendaMes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const v = parseMoedaBR(vendaValor);
                  if (v == null) {
                    setErro("Valor final inválido.");
                    return;
                  }
                  const res = await marcarVenda(n.id, v, `${vendaMes}-01`);
                  if (!res.ok) {
                    setErro(res.error);
                    return;
                  }
                  setVendaOpen(false);
                  setN((p) => ({
                    ...p,
                    status: "vendida",
                    valorFinal: v,
                    fechadoEm: new Date().toISOString(),
                  }));
                })
              }
            >
              Confirmar venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={perdaOpen} onOpenChange={setPerdaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar perda</DialogTitle>
            <DialogDescription>O motivo é obrigatório.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Motivo *</label>
              <select
                value={perdaMotivo}
                onChange={(e) => setPerdaMotivo(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Selecione…</option>
                {motivosPerda.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Anotação</label>
              <Textarea
                value={perdaAnotacao}
                onChange={(e) => setPerdaAnotacao(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !perdaMotivo}
              onClick={() =>
                run(async () => {
                  if (!perdaMotivo) {
                    setErro("Motivo da perda é obrigatório.");
                    return;
                  }
                  const res = await marcarPerda(
                    n.id,
                    perdaMotivo,
                    perdaAnotacao,
                  );
                  if (!res.ok) {
                    setErro(res.error);
                    return;
                  }
                  setPerdaOpen(false);
                  setN((p) => ({
                    ...p,
                    status: "perdida",
                    motivoPerda: perdaMotivo,
                    anotacaoFechamento: perdaAnotacao || null,
                    fechadoEm: new Date().toISOString(),
                  }));
                })
              }
            >
              Confirmar perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excluirOpen} onOpenChange={setExcluirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir negociação</DialogTitle>
            <DialogDescription>
              Isso apaga definitivamente &ldquo;{n.titulo}&rdquo;, junto com
              interações, ações e orçamentos. Não dá para desfazer. Se a ideia é
              só tirar da tela, prefira <strong>Arquivar</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setExcluirOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await excluirNegociacao(n.id);
                  if (!res.ok) {
                    setErro(res.error);
                    setExcluirOpen(false);
                    return;
                  }
                  setExcluirOpen(false);
                  router.push("/funil");
                })
              }
            >
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orcOpen} onOpenChange={setOrcOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo orçamento</DialogTitle>
            <DialogDescription>
              Anexe um PDF pronto ou monte o orçamento com itens do catálogo da
              empresa vendedora.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Anexar PDF</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Valor *</label>
              <Input
                value={orcValor}
                onChange={(e) => setOrcValor(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Data envio</label>
                <Input
                  type="date"
                  value={orcEnvio}
                  onChange={(e) => setOrcEnvio(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Validade</label>
                <Input
                  type="date"
                  value={orcValidade}
                  onChange={(e) => setOrcValidade(e.target.value)}
                />
              </div>
            </div>
            <Input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setOrcArquivo(e.target.files?.[0] ?? null)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={orcAtualizarValor}
                onChange={(e) => setOrcAtualizarValor(e.target.checked)}
              />
              Atualizar valor estimado da negociação
            </label>
            <Button
              type="button"
              disabled={pending || !orcArquivo}
              onClick={() =>
                run(async () => {
                  const v = parseMoedaBR(orcValor);
                  if (v == null) {
                    setErro("Valor do orçamento inválido.");
                    return;
                  }
                  if (!orcArquivo) {
                    setErro("Selecione um PDF.");
                    return;
                  }
                  const fd = new FormData();
                  fd.set("negociacaoId", n.id);
                  fd.set("valor", String(v));
                  fd.set("enviado_em", orcEnvio);
                  if (orcValidade) fd.set("validade", orcValidade);
                  fd.set(
                    "atualizarValor",
                    orcAtualizarValor ? "true" : "false",
                  );
                  fd.set("arquivo", orcArquivo);
                  const res = await criarOrcamentoUpload(fd);
                  if (!res.ok) {
                    setErro(res.error);
                    return;
                  }
                  setOrcOpen(false);
                  if (orcAtualizarValor) {
                    setN((p) => ({ ...p, valorEstimado: v }));
                    setValorLocal(formatarMoeda(v).replace(/^R\$\s?/, ""));
                  }
                })
              }
            >
              Salvar orçamento
            </Button>
            <div className="border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await criarOrcamentoGerado(n.id);
                    if (!res.ok) {
                      setErro(res.error);
                      return;
                    }
                    setOrcOpen(false);
                    if (res.orcamentoId)
                      router.push(`/orcamentos/${res.orcamentoId}`);
                  })
                }
              >
                Montar orçamento
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Cria um orçamento numerado com os dados da empresa vendedora; os
                itens são escolhidos na próxima tela. Substitui o orçamento
                enviado anterior.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editarAcaoOpen} onOpenChange={setEditarAcaoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar ação</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Textarea
              value={acaoEdit.descricao}
              onChange={(e) =>
                setAcaoEdit((a) => ({ ...a, descricao: e.target.value }))
              }
              rows={2}
            />
            <Input
              type="date"
              value={acaoEdit.data}
              onChange={(e) =>
                setAcaoEdit((a) => ({ ...a, data: e.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={pending || !proximaAcao || !acaoEdit.descricao.trim()}
              onClick={() =>
                run(async () => {
                  if (!proximaAcao) return;
                  const res = await atualizarAcao({
                    id: proximaAcao.id,
                    descricao: acaoEdit.descricao,
                    data: acaoEdit.data,
                  });
                  if (!res.ok) {
                    setErro(res.error);
                    return;
                  }
                  setEditarAcaoOpen(false);
                })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={novaAcaoOpen} onOpenChange={setNovaAcaoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova ação</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Textarea
              value={acaoEdit.descricao}
              onChange={(e) =>
                setAcaoEdit((a) => ({ ...a, descricao: e.target.value }))
              }
              placeholder="Descrição"
              rows={2}
            />
            <Input
              type="date"
              value={acaoEdit.data}
              onChange={(e) =>
                setAcaoEdit((a) => ({ ...a, data: e.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={pending || !acaoEdit.descricao.trim()}
              onClick={() =>
                run(async () => {
                  const res = await criarAcao({
                    negociacao_id: n.id,
                    descricao: acaoEdit.descricao,
                    data: acaoEdit.data,
                    tipo: "ligar",
                  });
                  if (!res.ok) {
                    setErro(res.error);
                    return;
                  }
                  setNovaAcaoOpen(false);
                  setAcaoEdit({ descricao: "", data: hojeISO() });
                })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contatoNovoOpen} onOpenChange={setContatoNovoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo contato</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Nome *"
              value={contatoNovo.nome}
              onChange={(e) =>
                setContatoNovo((c) => ({ ...c, nome: e.target.value }))
              }
            />
            <Input
              placeholder="WhatsApp (só dígitos c/ DDI)"
              value={contatoNovo.whatsapp}
              onChange={(e) =>
                setContatoNovo((c) => ({ ...c, whatsapp: e.target.value }))
              }
            />
            <Input
              placeholder="Cargo"
              value={contatoNovo.cargo}
              onChange={(e) =>
                setContatoNovo((c) => ({ ...c, cargo: e.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={pending || !contatoNovo.nome.trim()}
              onClick={() =>
                run(async () => {
                  const res = await criarContato({
                    empresa_id: n.empresaId,
                    nome: contatoNovo.nome,
                    whatsapp: contatoNovo.whatsapp.replace(/\D/g, "") || null,
                    cargo: contatoNovo.cargo || null,
                    email: null,
                    decisor: false,
                  });
                  if (!res.ok) {
                    setErro(res.error);
                    return;
                  }
                  await atualizarCampo(n.id, "contato_id", res.contato.id);
                  setN((p) => ({ ...p, contatoId: res.contato.id }));
                  setContatoNovoOpen(false);
                  setContatoNovo({ nome: "", whatsapp: "", cargo: "" });
                })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MiniFormProximaAcao
        open={miniOpen}
        onOpenChange={setMiniOpen}
        negociacaoId={n.id}
      />
    </Pagina>
  );
}
