import { escaparHtml } from "@/lib/email";

function layoutEmail(opts: {
  titulo: string;
  preheader: string;
  corpoHtml: string;
}): { subject: string; html: string; text: string } {
  const marca = "CRM F-Led";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escaparHtml(opts.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escaparHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#0f3d2e;padding:20px 28px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">${escaparHtml(marca)}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#b7d4c8;">Gestão comercial</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f3d2e;">${escaparHtml(opts.titulo)}</h1>
              ${opts.corpoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.5;">
                Este e-mail foi enviado automaticamente pelo ${escaparHtml(marca)}.
                Se você não solicitou esta mensagem, pode ignorá-la.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${opts.titulo}\n\n${opts.preheader}\n\n— ${marca}`;
  return { subject: opts.titulo, html, text };
}

function botao(href: string, label: string): string {
  return `<p style="margin:24px 0;">
  <a href="${escaparHtml(href)}" style="display:inline-block;background:#0f3d2e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px;">
    ${escaparHtml(label)}
  </a>
</p>
<p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;">
  Se o botão não funcionar, copie e cole este link no navegador:<br />
  <a href="${escaparHtml(href)}" style="color:#0f3d2e;">${escaparHtml(href)}</a>
</p>`;
}

export function emailConvite(opts: {
  nome: string;
  link: string;
  convidadoPor?: string | null;
  empresaNome?: string | null;
}): { subject: string; html: string; text: string } {
  const saudacao = opts.nome.trim() || "olá";
  const empresa = opts.empresaNome
    ? ` na empresa <strong>${escaparHtml(opts.empresaNome)}</strong>`
    : "";
  const por = opts.convidadoPor
    ? ` por <strong>${escaparHtml(opts.convidadoPor)}</strong>`
    : "";
  const corpo = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
      Olá, ${escaparHtml(saudacao)}!
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
      Você foi convidado${por} para acessar o CRM F-Led${empresa}.
      Clique no botão abaixo para definir sua senha e entrar.
    </p>
    ${botao(opts.link, "Definir senha e entrar")}
    <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
      O link expira em algumas horas. Se expirar, peça um novo convite ao diretor.
    </p>`;
  return layoutEmail({
    titulo: "Convite para o CRM F-Led",
    preheader: "Defina sua senha e comece a usar o CRM.",
    corpoHtml: corpo,
  });
}

export function emailRecuperacaoSenha(opts: {
  link: string;
}): { subject: string; html: string; text: string } {
  const corpo = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
      Recebemos um pedido para redefinir a senha da sua conta no CRM F-Led.
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
      Clique no botão abaixo para escolher uma nova senha. Se você não pediu isso,
      ignore este e-mail — sua senha atual continua valendo.
    </p>
    ${botao(opts.link, "Redefinir senha")}
    <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
      Por segurança, o link expira em pouco tempo.
    </p>`;
  return layoutEmail({
    titulo: "Redefinição de senha",
    preheader: "Escolha uma nova senha para o CRM F-Led.",
    corpoHtml: corpo,
  });
}
