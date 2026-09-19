/**
 * Redefine a senha de um usuário no Supabase Auth SEM enviar e-mail.
 * Use quando o rate limit de e-mail do Supabase estiver estourado.
 *
 * 1) No Vercel → crm-fled → Settings → Environment Variables,
 *    copie SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL
 * 2) Rode:
 *
 *    NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co \
 *    SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *    EMAIL=seu@email.com \
 *    NOVA_SENHA='SuaSenhaForte123!' \
 *    node scripts/set-password.mjs
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.EMAIL?.trim().toLowerCase();
const password = process.env.NOVA_SENHA;

if (!url || !serviceKey || !email || !password) {
  console.error(
    "Faltam variáveis. Exporte NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL e NOVA_SENHA.",
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("NOVA_SENHA deve ter pelo menos 8 caracteres.");
  process.exit(1);
}

async function main() {
  const listRes = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!listRes.ok) {
    console.error("Falha ao listar usuários:", listRes.status, await listRes.text());
    process.exit(1);
  }
  const body = await listRes.json();
  const users = body.users ?? body;
  const user = users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!user) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const upd = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  if (!upd.ok) {
    console.error("Falha ao atualizar senha:", upd.status, await upd.text());
    process.exit(1);
  }

  console.log(`Senha atualizada para ${email}.`);
  console.log("Entre em https://crm-fled.vercel.app/login");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
