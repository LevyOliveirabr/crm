import { LoginForm } from "@/components/crm/login-form";

const MENSAGENS_ERRO: Record<string, string> = {
  inativo: "Usuário desativado. Fale com o diretor.",
  convite:
    "Link inválido ou expirado. Tente “Esqueci minha senha” ou peça um novo convite.",
  google:
    "Não foi possível entrar com Google. Use o mesmo e-mail do convite ou entre com e-mail e senha.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const params = await searchParams;
  const erroInicial = params.erro ? MENSAGENS_ERRO[params.erro] : undefined;

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
            Entre com o e-mail e a senha do convite, ou com sua conta Google.
          </p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-background/90 p-6 shadow-sm backdrop-blur">
          <LoginForm erroInicial={erroInicial} next={params.next} />
        </div>
      </div>
    </div>
  );
}
