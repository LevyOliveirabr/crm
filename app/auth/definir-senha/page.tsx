import { AuthHashBridge } from "@/components/crm/auth-hash-bridge";
import { DefinirSenhaForm } from "@/components/crm/definir-senha-form";
import { createClient } from "@/lib/supabase/server";

export default async function DefinirSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100 via-background to-zinc-200 px-4 py-10">
      <AuthHashBridge />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            F-Led
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Definir senha
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user
              ? "Escolha uma senha para acessar o CRM."
              : "Abra o link do convite no e-mail para continuar."}
          </p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-background/90 p-6 shadow-sm backdrop-blur">
          {user ? (
            <DefinirSenhaForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sessão do convite não encontrada. Peça um novo convite ao diretor
              ou confira se a URL de redirecionamento no Supabase inclui{" "}
              <code className="text-xs">/auth/definir-senha</code>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
