"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Funnel,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Settings,
  Sun,
  Users,
} from "lucide-react";

import { logoutAction } from "@/lib/actions/auth";
import type { UsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  diretorOnly?: boolean;
};

type NavGrupo = {
  titulo: string;
  itens: NavItem[];
};

const NAV_GRUPOS: NavGrupo[] = [
  {
    titulo: "Comercial",
    itens: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/hoje", label: "Meu dia", icon: Sun },
      { href: "/funil", label: "Funil", icon: Funnel },
      { href: "/empresas", label: "Empresas", icon: Building2 },
      { href: "/contatos", label: "Contatos", icon: Users },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { href: "/configuracoes/api-keys", label: "API keys", icon: KeyRound },
      {
        href: "/configuracoes",
        label: "Configurações",
        icon: Settings,
        diretorOnly: true,
      },
    ],
  },
];

const NAV_TODOS = NAV_GRUPOS.flatMap((g) => g.itens);
const NAV_MOBILE_FIXA = NAV_TODOS.slice(0, 3);
const NAV_MOBILE_MAIS = NAV_TODOS.slice(3);

function filtrarNav(items: NavItem[], perfil: UsuarioAtual["perfil"]) {
  return items.filter((item) => !item.diretorOnly || perfil === "diretor");
}

function estaAtivo(pathname: string, href: string) {
  if (href === "/configuracoes") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) &&
        !pathname.startsWith("/configuracoes/api-keys"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  ativo,
  onNavigate,
  tema = "sidebar",
}: {
  item: NavItem;
  ativo: boolean;
  onNavigate?: () => void;
  tema?: "sidebar" | "sheet";
}) {
  const Icon = item.icon;
  const classesSidebar = ativo
    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
    : "text-sidebar-foreground/85 hover:bg-white/8 hover:text-sidebar-foreground";
  const classesSheet = ativo
    ? "bg-brand text-brand-foreground font-semibold"
    : "text-foreground hover:bg-muted";
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        tema === "sidebar" ? classesSidebar : classesSheet,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-heading text-sm font-bold tracking-tight text-brand-foreground"
      >
        F-L
      </span>
      <div className="min-w-0 leading-tight">
        <p className="font-heading text-base font-bold tracking-[0.06em]">
          F-LED
        </p>
        {compacta ? null : (
          <p className="text-[10.5px] font-medium tracking-[0.12em] uppercase opacity-60">
            CRM Comercial
          </p>
        )}
      </div>
    </div>
  );
}

export function AppShell({
  usuario,
  children,
}: {
  usuario: UsuarioAtual;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);
  const mobileFixa = filtrarNav(NAV_MOBILE_FIXA, usuario.perfil);
  const mobileMais = filtrarNav(NAV_MOBILE_MAIS, usuario.perfil);

  return (
    <div className="flex min-h-full bg-background">
      <aside className="hidden w-60 shrink-0 self-stretch bg-sidebar text-sidebar-foreground lg:block">
        <div className="sticky top-0 flex h-dvh flex-col px-3 py-5">
          <div className="mb-4 px-2">
            <Marca />
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            {NAV_GRUPOS.map((grupo) => {
              const itens = filtrarNav(grupo.itens, usuario.perfil);
              if (itens.length === 0) return null;
              return (
                <div key={grupo.titulo} className="mb-2">
                  <p className="px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-sidebar-foreground/50">
                    {grupo.titulo}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {itens.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        ativo={estaAtivo(pathname, item.href)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="mt-4 border-t border-sidebar-border pt-4">
            <div className="mb-2 flex items-center gap-3 px-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold uppercase">
                {iniciais(usuario.nome)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{usuario.nome}</p>
                <p className="truncate text-xs text-sidebar-foreground/60 capitalize">
                  {usuario.perfil}
                </p>
              </div>
            </div>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground/80 hover:bg-white/8 hover:text-sidebar-foreground"
              >
                <LogOut className="size-4" />
                Sair
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
          <Marca compacta />
          <p className="max-w-[40%] truncate text-sm text-sidebar-foreground/70">
            {usuario.nome}
          </p>
        </header>

        <main className="flex-1 overflow-x-hidden px-4 py-4 pb-24 lg:px-7 lg:py-6 lg:pb-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 lg:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
            {mobileFixa.map((item) => {
              const Icon = item.icon;
              const ativo = estaAtivo(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={ativo ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium",
                      ativo
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full",
                        ativo && "bg-brand text-brand-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
                <SheetTrigger className="flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                  <span className="grid size-7 place-items-center rounded-full">
                    <MoreHorizontal className="size-4" />
                  </span>
                  Mais
                </SheetTrigger>
                <SheetContent side="bottom" className="gap-0">
                  <SheetHeader>
                    <SheetTitle>Mais</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1 px-2 pb-6">
                    {mobileMais.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        tema="sheet"
                        onNavigate={() => setMaisAberto(false)}
                        ativo={estaAtivo(pathname, item.href)}
                      />
                    ))}
                    <form action={logoutAction} className="mt-2 px-1">
                      <Button type="submit" variant="outline" className="w-full">
                        Sair
                      </Button>
                    </form>
                  </div>
                </SheetContent>
              </Sheet>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0]![0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1]![0] ?? "" : "";
  return `${primeira}${ultima}`;
}
