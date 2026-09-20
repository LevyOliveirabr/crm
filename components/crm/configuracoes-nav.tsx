"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/configuracoes/funis", label: "Funis" },
  { href: "/configuracoes/listas", label: "Listas" },
  { href: "/configuracoes/metas", label: "Metas" },
  { href: "/configuracoes/parametros", label: "Parâmetros" },
  { href: "/configuracoes/empresas-vendedoras", label: "Empresas vendedoras" },
  { href: "/configuracoes/categorias", label: "Categorias" },
  { href: "/configuracoes/produtos", label: "Produtos" },
  { href: "/configuracoes/usuarios", label: "Usuários" },
  { href: "/configuracoes/importar", label: "Importar" },
] as const;

/** Rotas fora da navegação, mas dentro de Configurações. */
const EXTRAS: { href: string; label: string }[] = [
  { href: "/configuracoes/api-keys", label: "API keys" },
];

function ativo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Nome da seção atual, para o subtítulo do cabeçalho ("Configurações · Funis"). */
export function ConfiguracoesSubtitulo() {
  const pathname = usePathname();
  const atual =
    EXTRAS.find((l) => ativo(pathname, l.href)) ??
    LINKS.find((l) => ativo(pathname, l.href));
  return atual ? <>{atual.label}</> : null;
}

export function ConfiguracoesNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções de configurações"
      className="-mx-4 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0"
    >
      <div className="inline-flex gap-0.5 rounded-full border border-border bg-card p-0.5">
        {LINKS.map((link) => {
          const atual = ativo(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={atual ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors",
                atual
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
