"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CircleUserRound,
  Funnel,
  KeyRound,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
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

const NAV_PRINCIPAL: NavItem[] = [
  { href: "/hoje", label: "Hoje", icon: LayoutDashboard },
  { href: "/funil", label: "Funil", icon: Funnel },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/contatos", label: "Contatos", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  {
    href: "/configuracoes/api-keys",
    label: "API keys",
    icon: KeyRound,
  },
  {
    href: "/configuracoes/usuarios",
    label: "Configurações",
    icon: Settings,
    diretorOnly: true,
  },
];

const NAV_MOBILE_FIXA = NAV_PRINCIPAL.slice(0, 3);
const NAV_MOBILE_MAIS = NAV_PRINCIPAL.slice(3);

function filtrarNav(items: NavItem[], perfil: UsuarioAtual["perfil"]) {
  return items.filter((item) => !item.diretorOnly || perfil === "diretor");
}

function NavLink({
  item,
  ativo,
  onNavigate,
}: {
  item: NavItem;
  ativo: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        ativo
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
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
  const nav = filtrarNav(NAV_PRINCIPAL, usuario.perfil);
  const mobileFixa = filtrarNav(NAV_MOBILE_FIXA, usuario.perfil);
  const mobileMais = filtrarNav(NAV_MOBILE_MAIS, usuario.perfil);

  return (
    <div className="flex min-h-full bg-background">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
        <div className="mb-6 px-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            F-Led
          </p>
          <p className="text-lg font-semibold tracking-tight text-sidebar-foreground">
            CRM Comercial
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              ativo={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          ))}
        </nav>
        <div className="mt-4 border-t border-sidebar-border pt-4 px-1">
          <div className="mb-2 flex items-center gap-2 px-2">
            <CircleUserRound className="size-5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{usuario.nome}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">
                {usuario.perfil}
              </p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start"
            >
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              F-Led
            </p>
            <p className="text-base font-semibold tracking-tight">CRM</p>
          </div>
          <p className="max-w-[40%] truncate text-sm text-muted-foreground">
            {usuario.nome}
          </p>
        </header>

        <main className="flex-1 overflow-x-hidden px-4 py-4 pb-24 lg:px-6 lg:pb-6">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
            {mobileFixa.map((item) => {
              const Icon = item.icon;
              const ativo =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium",
                      ativo
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
                <SheetTrigger className="flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="size-5" />
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
                        onNavigate={() => setMaisAberto(false)}
                        ativo={
                          pathname === item.href ||
                          pathname.startsWith(`${item.href}/`)
                        }
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
