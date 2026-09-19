"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/configuracoes/funis", label: "Funis" },
  { href: "/configuracoes/listas", label: "Listas" },
  { href: "/configuracoes/metas", label: "Metas" },
  { href: "/configuracoes/parametros", label: "Parâmetros" },
  { href: "/configuracoes/emitente", label: "Emitente" },
  { href: "/configuracoes/produtos", label: "Produtos" },
  { href: "/configuracoes/usuarios", label: "Usuários" },
  { href: "/configuracoes/importar", label: "Importar" },
] as const;

export function ConfiguracoesNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {LINKS.map((link) => {
        const ativo =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              ativo
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
