import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Sistema de página: os mesmos blocos do Dashboard (cabeçalho, barra de
 * filtros em cartão, seção em cartão, tile numérico, estado vazio) para todas
 * as telas. Componentes server-safe (sem estado); use dentro de client
 * components livremente.
 */

/** Classe dos campos (select/input) dentro da barra de filtros. */
export const campoClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Container padrão de página (largura do Dashboard). */
export function Pagina({
  children,
  largura = "ampla",
  className,
}: {
  children: React.ReactNode;
  /** ampla = 1400px (listas, dashboards); media = 5xl (fichas, configurações); estreita = 4xl (documentos). */
  largura?: "ampla" | "media" | "estreita";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-4",
        largura === "ampla" && "max-w-[1400px]",
        largura === "media" && "max-w-5xl",
        largura === "estreita" && "max-w-4xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Cabeçalho de página: título grande, subtítulo em cinza, descrição e ações. */
export function PaginaCabecalho({
  titulo,
  subtitulo,
  descricao,
  acoes,
  voltar,
  className,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  /** Link "voltar" acima do título (fichas). */
  voltar?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 print:hidden",
        className,
      )}
    >
      <div className="min-w-0">
        {voltar ? (
          <Link
            href={voltar.href}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {voltar.label}
          </Link>
        ) : null}
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {titulo}
          {subtitulo ? (
            <span className="font-medium text-muted-foreground"> · {subtitulo}</span>
          ) : null}
        </h1>
        {descricao ? (
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        ) : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </header>
  );
}

/** Barra de filtros em cartão (grid responsivo). */
export function BarraFiltros({
  children,
  className,
  acoes,
}: {
  children: React.ReactNode;
  className?: string;
  /** Ex.: botão "Limpar filtros" à direita. */
  acoes?: React.ReactNode;
}) {
  return (
    <section
      aria-label="Filtros"
      className={cn("card-surface flex flex-col gap-3 p-4 print:hidden", className)}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {children}
      </div>
      {acoes ? <div className="flex justify-end">{acoes}</div> : null}
    </section>
  );
}

/** Campo da barra de filtros: rótulo em caixa alta + controle. */
export function CampoFiltro({
  id,
  label,
  children,
  className,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Seção em cartão com título, informação à direita e ações. */
export function Secao({
  titulo,
  meta,
  acoes,
  children,
  className,
  id,
  destaque = false,
  semPadding = false,
}: {
  titulo?: React.ReactNode;
  meta?: React.ReactNode;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Faixa amarela à esquerda (formulários abertos, avisos). */
  destaque?: boolean;
  /** Conteúdo colado nas bordas (tabelas largas). */
  semPadding?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "card-surface",
        semPadding ? "overflow-hidden" : "p-4 sm:p-5",
        destaque && "border-l-4 border-l-brand",
        className,
      )}
    >
      {titulo || meta || acoes ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2",
            semPadding ? "px-4 pt-4 pb-2 sm:px-5 sm:pt-5" : "mb-3",
          )}
        >
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {titulo ? (
              <h2 className="font-heading text-base font-semibold sm:text-lg">{titulo}</h2>
            ) : null}
            {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
          </div>
          {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Contador numérico para o título de uma seção ("Atrasadas" + 3). */
export function Contador({
  valor,
  tom,
}: {
  valor: number;
  tom?: "ok" | "ruim" | "alerta";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
        tom === "ruim" && "bg-danger-bg text-destructive",
        tom === "ok" && "bg-success-bg text-success",
        tom === "alerta" && "bg-brand/30 text-brand-foreground",
        !tom && "bg-muted text-muted-foreground",
      )}
    >
      {valor}
    </span>
  );
}

/** Tile numérico (o KPI do Dashboard). */
export function Tile({
  label,
  valor,
  detalhe,
  tom,
  destaque = false,
  className,
}: {
  label: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  tom?: "ok" | "ruim";
  destaque?: boolean;
  className?: string;
}) {
  return (
    <div
      role="listitem"
      className={cn(
        "card-surface flex flex-col justify-center px-4 py-3.5",
        destaque && "border-primary bg-primary text-primary-foreground",
        className,
      )}
    >
      <p className={cn("eyebrow", destaque && "text-primary-foreground/65")}>{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-2xl font-semibold tracking-tight tabular-nums",
          destaque && "text-brand",
          !destaque && tom === "ok" && "text-success",
          !destaque && tom === "ruim" && "text-destructive",
        )}
      >
        {valor}
      </p>
      {detalhe ? (
        <p
          className={cn(
            "mt-0.5 text-xs text-muted-foreground",
            destaque && "text-primary-foreground/70",
          )}
        >
          {detalhe}
        </p>
      ) : null}
    </div>
  );
}

/** Grid de tiles. */
export function Tiles({
  children,
  colunas = 3,
  className,
}: {
  children: React.ReactNode;
  colunas?: 2 | 3 | 4 | 6 | 7;
  className?: string;
}) {
  return (
    <div
      role="list"
      className={cn(
        "grid gap-3",
        colunas === 2 && "grid-cols-2",
        colunas === 3 && "grid-cols-1 sm:grid-cols-3",
        colunas === 4 && "grid-cols-2 lg:grid-cols-4",
        colunas === 6 && "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
        colunas === 7 && "grid-cols-2 sm:grid-cols-4 xl:grid-cols-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Estado vazio centralizado. */
export function EstadoVazio({
  texto,
  acao,
  icone: Icone,
  compacto = false,
}: {
  texto: React.ReactNode;
  acao?: React.ReactNode;
  icone?: React.ComponentType<{ className?: string }>;
  compacto?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 text-center text-sm text-muted-foreground",
        compacto ? "py-4" : "py-8",
      )}
    >
      {Icone ? <Icone className="size-5 opacity-50" /> : null}
      <p>{texto}</p>
      {acao}
    </div>
  );
}

/** Alternador de visão em pílula (Kanban/Lista, abas). */
export function Pilulas({
  opcoes,
  valor,
  onChange,
  ariaLabel,
}: {
  opcoes: { id: string; label: React.ReactNode; icone?: React.ComponentType<{ className?: string }>; href?: string }[];
  valor: string;
  onChange?: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-0.5 rounded-full border border-border bg-card p-0.5"
    >
      {opcoes.map((o) => {
        const ativo = o.id === valor;
        const Icone = o.icone;
        const cls = cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
          ativo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        );
        return o.href ? (
          <Link key={o.id} href={o.href} role="tab" aria-selected={ativo} className={cls}>
            {Icone ? <Icone className="size-4" /> : null}
            {o.label}
          </Link>
        ) : (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange?.(o.id)}
            className={cls}
          >
            {Icone ? <Icone className="size-4" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
