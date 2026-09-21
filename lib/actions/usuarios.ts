"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAppUrl } from "@/lib/app-url";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { empresasOndeEhDiretor } from "@/lib/auth/permissoes";
import { exigirDiretorDe, exigirDiretorEmAlguma } from "@/lib/auth/permissoes-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { emailHabilitado, enviarEmail } from "@/lib/email";
import { emailConvite } from "@/lib/email/templates";

export type UsuarioActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
};

type Perfil = Database["public"]["Enums"]["perfil_usuario"];

const perfilSchema = z.enum(["diretor", "gerente", "vendedor"]);

const convidarSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z.email("Informe um e-mail válido."),
  perfil: perfilSchema,
  emitente_id: z.uuid("Escolha a empresa vendedora."),
});

/**
 * Convida um usuário e o vincula a uma empresa vendedora com o perfil
 * escolhido. Quem convida precisa ser diretor dessa empresa.
 */
export async function convidarUsuarioAction(
  _prev: UsuarioActionState,
  formData: FormData,
): Promise<UsuarioActionState> {
  const parsed = convidarSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    perfil: formData.get("perfil"),
    emitente_id: formData.get("emitente_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const diretor = await exigirDiretorDe(parsed.data.emitente_id);
  if (!diretor) {
    return { error: "Apenas o diretor da empresa pode convidar usuários para ela." };
  }

  const appUrl = getAppUrl();
  const admin = createAdminClient();
  const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent("/auth/definir-senha")}`;

  let userId: string | null = null;

  if (emailHabilitado()) {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email: parsed.data.email,
      options: {
        data: {
          nome: parsed.data.nome,
          perfil: parsed.data.perfil,
        },
        redirectTo,
      },
    });
    if (linkErr) return { error: linkErr.message };
    userId = linkData.user?.id ?? null;
    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
      return { error: "Não foi possível gerar o link de convite." };
    }
    const empresaNome =
      diretor.empresas.find((e) => e.id === parsed.data.emitente_id)?.nome ?? null;
    const msg = emailConvite({
      nome: parsed.data.nome,
      link: actionLink,
      convidadoPor: diretor.nome,
      empresaNome,
    });
    const envio = await enviarEmail({
      to: parsed.data.email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    if (!envio.ok && !("skipped" in envio && envio.skipped)) {
      return { error: envio.error ?? "Falha ao enviar o e-mail de convite." };
    }
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        data: {
          nome: parsed.data.nome,
          perfil: parsed.data.perfil,
        },
        redirectTo,
      },
    );
    if (error) return { error: error.message };
    userId = data.user?.id ?? null;
  }

  if (userId) {
    // o trigger handle_new_auth_user cria a linha em usuarios; o vínculo é feito aqui
    const { error: erroVinculo } = await admin.from("usuario_emitentes").upsert(
      {
        usuario_id: userId,
        emitente_id: parsed.data.emitente_id,
        perfil: parsed.data.perfil,
      },
      { onConflict: "usuario_id,emitente_id" },
    );
    if (erroVinculo) {
      return { error: `Convite enviado, mas falhou o vínculo com a empresa: ${erroVinculo.message}` };
    }
  }

  revalidatePath("/configuracoes/usuarios");
  return { ok: true, message: `Convite enviado para ${parsed.data.email}.` };
}

export async function alternarUsuarioAtivoAction(
  id: string,
  ativo: boolean,
): Promise<UsuarioActionState> {
  const diretor = await exigirDiretorEmAlguma();
  if (!diretor) {
    return { error: "Apenas o diretor pode alterar usuários." };
  }

  if (diretor.id === id && !ativo) {
    return { error: "Você não pode desativar a si mesmo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ ativo })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/configuracoes/usuarios");
  return { ok: true };
}

const vinculoSchema = z.object({
  usuarioId: z.uuid(),
  emitenteId: z.uuid(),
  /** null = remover o vínculo. */
  perfil: perfilSchema.nullable(),
  gerenteId: z.uuid().nullable().optional(),
});

/**
 * Define (ou remove) o vínculo de um usuário com uma empresa vendedora:
 * perfil naquela empresa e, para vendedores, o gerente.
 */
export async function definirVinculoAction(input: {
  usuarioId: string;
  emitenteId: string;
  perfil: Perfil | null;
  gerenteId?: string | null;
}): Promise<UsuarioActionState> {
  const parsed = vinculoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { usuarioId, emitenteId, perfil, gerenteId } = parsed.data;

  const diretor = await exigirDiretorDe(emitenteId);
  if (!diretor) return { error: "Apenas o diretor desta empresa pode alterar vínculos." };
  if (diretor.id === usuarioId && perfil !== "diretor") {
    return { error: "Você não pode rebaixar ou remover a si mesmo desta empresa." };
  }
  if (gerenteId && gerenteId === usuarioId) {
    return { error: "Um usuário não pode ser gerente de si mesmo." };
  }

  const supabase = await createClient();

  if (perfil === null) {
    const { error } = await supabase
      .from("usuario_emitentes")
      .delete()
      .eq("usuario_id", usuarioId)
      .eq("emitente_id", emitenteId);
    if (error) return { error: error.message };
    revalidatePath("/configuracoes/usuarios");
    return { ok: true };
  }

  if (gerenteId) {
    const { data: g } = await supabase
      .from("usuario_emitentes")
      .select("perfil")
      .eq("usuario_id", gerenteId)
      .eq("emitente_id", emitenteId)
      .maybeSingle();
    if (!g || g.perfil !== "gerente") {
      return { error: "Escolha um gerente da mesma empresa." };
    }
  }

  const { error } = await supabase.from("usuario_emitentes").upsert(
    {
      usuario_id: usuarioId,
      emitente_id: emitenteId,
      perfil,
      gerente_id: perfil === "vendedor" ? (gerenteId ?? null) : null,
    },
    { onConflict: "usuario_id,emitente_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/configuracoes/usuarios");
  revalidatePath("/", "layout");
  return { ok: true };
}

const atualizarUsuarioSchema = z.object({
  id: z.uuid(),
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z.email("Informe um e-mail válido."),
  cargo: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().nullable(),
  ),
  telefone: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().nullable(),
  ),
  whatsapp: z.preprocess(
    (v) => (v === "" || v === undefined ? null : String(v).replace(/\D/g, "") || null),
    z.string().nullable(),
  ),
  linkedin: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().nullable(),
  ),
});

/**
 * Edita dados do usuário (nome, e-mail Auth, cargo e contatos).
 * Só diretor em alguma empresa.
 */
export async function atualizarUsuarioAction(
  input: z.input<typeof atualizarUsuarioSchema>,
): Promise<UsuarioActionState> {
  const parsed = atualizarUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const diretor = await exigirDiretorEmAlguma();
  if (!diretor) {
    return { error: "Apenas o diretor pode editar usuários." };
  }

  const supabase = await createClient();
  const { data: atual, error: erroAtual } = await supabase
    .from("usuarios")
    .select("id, email")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (erroAtual || !atual) {
    return { error: "Usuário não encontrado." };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({
      nome: parsed.data.nome,
      email: parsed.data.email,
      cargo: parsed.data.cargo,
      telefone: parsed.data.telefone,
      whatsapp: parsed.data.whatsapp,
      linkedin: parsed.data.linkedin,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  if (parsed.data.email !== atual.email) {
    const admin = createAdminClient();
    const { error: authErr } = await admin.auth.admin.updateUserById(
      parsed.data.id,
      { email: parsed.data.email },
    );
    if (authErr) {
      return {
        error: `Dados salvos, mas falhou atualizar o e-mail de login: ${authErr.message}`,
      };
    }
  }

  revalidatePath("/configuracoes/usuarios");
  return { ok: true, message: "Usuário atualizado." };
}

export type VinculoUsuario = {
  emitenteId: string;
  perfil: Perfil;
  gerenteId: string | null;
};

export type UsuarioLista = Database["public"]["Tables"]["usuarios"]["Row"] & {
  vinculos: VinculoUsuario[];
};

/** Usuários com os vínculos por empresa (o diretor vê os vínculos das empresas que dirige). */
export async function listarUsuarios(): Promise<UsuarioLista[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.ehDiretorEmAlguma) return [];
  const dirigidas = empresasOndeEhDiretor(usuario);

  const supabase = await createClient();
  const [{ data, error }, { data: vinculos }] = await Promise.all([
    supabase.from("usuarios").select("*").order("nome"),
    supabase
      .from("usuario_emitentes")
      .select("usuario_id, emitente_id, perfil, gerente_id")
      .in("emitente_id", dirigidas.length ? dirigidas : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  if (error || !data) return [];
  const porUsuario = new Map<string, VinculoUsuario[]>();
  for (const v of vinculos ?? []) {
    const lista = porUsuario.get(v.usuario_id) ?? [];
    lista.push({ emitenteId: v.emitente_id, perfil: v.perfil, gerenteId: v.gerente_id });
    porUsuario.set(v.usuario_id, lista);
  }
  return data.map((u) => ({ ...u, vinculos: porUsuario.get(u.id) ?? [] }));
}
