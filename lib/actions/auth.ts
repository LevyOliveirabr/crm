"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export type AuthActionState = {
  error?: string;
  ok?: boolean;
};

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "E-mail ou senha incorretos." };
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!usuario?.ativo) {
    await supabase.auth.signOut();
    return { error: "Usuário desativado. Fale com o diretor." };
  }

  redirect("/hoje");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const emailSchema = z.object({
  email: z.email("Informe um e-mail válido."),
});

export async function esqueciSenhaAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const appUrl = getAppUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent("/auth/definir-senha")}`,
  });

  if (error) {
    console.error("[esqueci-senha]", error.message);
    const msg = error.message.toLowerCase();
    if (
      msg.includes("rate") ||
      msg.includes("limit") ||
      msg.includes("seconds") ||
      msg.includes("too many")
    ) {
      return {
        error:
          "Muitos e-mails enviados. Espere cerca de 1 hora (limite do Supabase) e tente de novo. Confira também o spam.",
      };
    }
    return {
      error:
        "Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos ou peça ao diretor para redefinir no painel do Supabase.",
    };
  }

  return {
    ok: true,
    error: undefined,
  };
}

const senhaSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
    passwordConfirm: z.string().min(1, "Confirme a senha."),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "As senhas não coincidem.",
    path: ["passwordConfirm"],
  });

export async function definirSenhaAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = senhaSchema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Link inválido ou expirado. Use “Esqueci minha senha” no login ou peça um novo convite ao diretor.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/hoje");
}
