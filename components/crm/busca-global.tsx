"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Handshake, Search, UserRound } from "lucide-react";

import { buscarGlobal, type ResultadoBusca } from "@/lib/actions/busca";
import { formatarMoedaCurta } from "@/lib/format";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const VAZIO: ResultadoBusca = { empresas: [], contatos: [], negociacoes: [] };

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  vendida: "Vendida",
  perdida: "Perdida",
};

export function BuscaGlobal({
  className,
  compacta = false,
}: {
  className?: string;
  compacta?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultado, setResultado] = useState<ResultadoBusca>(VAZIO);
  const [carregando, setCarregando] = useState(false);
  const ultimaBusca = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = termo.trim();
    if (q.length < 2) return;
    const id = ++ultimaBusca.current;
    const t = setTimeout(async () => {
      const r = await buscarGlobal(q);
      if (id === ultimaBusca.current) {
        setResultado(r);
        setCarregando(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [termo, open]);

  function onTermoChange(v: string) {
    setTermo(v);
    if (v.trim().length < 2) {
      ultimaBusca.current += 1;
      setResultado(VAZIO);
      setCarregando(false);
    } else {
      setCarregando(true);
    }
  }

  const ir = useCallback(
    (href: string) => {
      setOpen(false);
      setTermo("");
      router.push(href);
    },
    [router],
  );

  const vazio =
    resultado.empresas.length + resultado.contatos.length + resultado.negociacoes.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar (Ctrl+K)"
        className={cn(
          compacta
            ? "grid size-9 place-items-center rounded-full text-sidebar-foreground/80 hover:bg-white/10"
            : "flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground",
          className,
        )}
      >
        <Search className="size-4 shrink-0" />
        {compacta ? null : (
          <>
            <span className="flex-1 text-left">Buscar…</span>
            <kbd className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-sidebar-foreground/60">
              Ctrl K
            </kbd>
          </>
        )}
      </button>

      <CommandDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) onTermoChange("");
        }}
        title="Busca"
        description="Empresas, contatos e negociações"
        className="sm:max-w-lg"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Empresa, contato ou negociação…"
            value={termo}
            onValueChange={onTermoChange}
          />
          <CommandList>
            {termo.trim().length < 2 ? (
              <CommandEmpty>Digite pelo menos 2 letras.</CommandEmpty>
            ) : carregando && vazio ? (
              <CommandEmpty>Buscando…</CommandEmpty>
            ) : vazio ? (
              <CommandEmpty>Nada encontrado.</CommandEmpty>
            ) : null}

            {resultado.negociacoes.length > 0 ? (
              <CommandGroup heading="Negociações">
                {resultado.negociacoes.map((n) => (
                  <CommandItem
                    key={n.id}
                    value={`neg-${n.id}`}
                    onSelect={() => ir(`/negociacoes/${n.id}`)}
                  >
                    <Handshake className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{n.titulo}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {n.empresaNome} · {n.etapaNome || STATUS_LABEL[n.status] || n.status}
                      </span>
                    </span>
                    <span className="text-xs font-semibold tabular-nums">
                      {formatarMoedaCurta(n.valor)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {resultado.empresas.length > 0 ? (
              <CommandGroup heading="Empresas">
                {resultado.empresas.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={`emp-${e.id}`}
                    onSelect={() => ir(`/empresas/${e.id}`)}
                  >
                    <Building2 className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{e.nome}</span>
                      {e.cidade || e.uf ? (
                        <span className="block text-xs text-muted-foreground">
                          {[e.cidade, e.uf].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {resultado.contatos.length > 0 ? (
              <CommandGroup heading="Contatos">
                {resultado.contatos.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`con-${c.id}`}
                    onSelect={() => ir(`/empresas/${c.empresaId}`)}
                  >
                    <UserRound className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{c.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[c.cargo, c.empresaNome].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
