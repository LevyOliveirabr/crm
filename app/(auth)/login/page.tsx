import { LoginForm } from "@/components/crm/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const params = await searchParams;
  const erroInicial =
    params.erro === "inativo"
      ? "Usuário desativado. Fale com o diretor."
      : undefined;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100 via-background to-zinc-200 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            F-Led
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            CRM Comercial
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre com o e-mail e a senha do convite.
          </p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-background/90 p-6 shadow-sm backdrop-blur">
          <LoginForm erroInicial={erroInicial} />
        </div>
      </div>
    </div>
  );
}
