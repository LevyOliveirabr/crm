import type { SupabaseClient } from "@supabase/supabase-js";

import { getAppUrl } from "@/lib/app-url";
import type { Database } from "@/lib/database.types";
import { emailHabilitado, enviarEmail, escaparHtml } from "@/lib/email";
import { formatarData, formatarMoeda, hojeISO } from "@/lib/format";

type Client = SupabaseClient<Database>;

export type AcaoLembrete = {
  id: string;
  descricao: string;
  tipo: string;
  data: string;
  responsavelId: string;
  negociacaoId: string;
  negociacaoTitulo: string;
  empresaNome: string;
  emitenteNome: string | null;
  valor: number;
  atrasada: boolean;
};

export type ResumoLembrete = {
  hoje: string;
  usuarios: {
    id: string;
    nome: string;
    email: string;
    /** Diretor em alguma empresa vendedora (recebe o resumo da equipe). */
    diretor: boolean;
    atrasadas: AcaoLembrete[];
    deHoje: AcaoLembrete[];
    semAcao: number;
  }[];
};

const TIPO_LABEL: Record<string, string> = {
  ligar: "Ligar",
  whatsapp: "WhatsApp",
  visita: "Visita",
  reuniao: "Reunião",
  proposta: "Proposta",
  outro: "Outro",
};

/**
 * Monta o resumo do dia por usuário: ações atrasadas, ações de hoje e
 * negociações abertas sem próxima ação. Usa o client admin (cron roda sem
 * sessão), então filtra explicitamente por responsável.
 */
export async function montarResumoDiario(
  supabase: Client,
): Promise<ResumoLembrete> {
  const hoje = hojeISO();

  const [{ data: usuarios }, { data: acoesRaw }, { data: semAcaoRaw }, { data: diretoresRaw }] =
    await Promise.all([
      supabase
        .from("usuarios")
        .select("id, nome, email, perfil")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("acoes")
        .select(
          `id, descricao, tipo, data, responsavel_id, negociacao_id,
           negociacoes!inner ( id, titulo, status, arquivado_em, valor_estimado, responsavel_id, empresas ( nome ), emitentes ( nome ) )`,
        )
        .is("concluida_em", null)
        .lte("data", hoje)
        .eq("negociacoes.status", "aberta")
        .is("negociacoes.arquivado_em", null)
        .order("data", { ascending: true }),
      supabase
        .from("v_negociacoes")
        .select("id, responsavel_id")
        .eq("status", "aberta")
        .eq("sem_acao", true),
      supabase.from("usuario_emitentes").select("usuario_id").eq("perfil", "diretor"),
    ]);
  const diretores = new Set((diretoresRaw ?? []).map((d) => d.usuario_id));

  type Join = {
    id: string;
    descricao: string;
    tipo: string;
    data: string;
    responsavel_id: string;
    negociacao_id: string;
    negociacoes:
      | {
          titulo: string;
          valor_estimado: number;
          responsavel_id: string;
          empresas: { nome: string } | { nome: string }[] | null;
          emitentes: { nome: string } | { nome: string }[] | null;
        }
      | {
          titulo: string;
          valor_estimado: number;
          responsavel_id: string;
          empresas: { nome: string } | { nome: string }[] | null;
          emitentes: { nome: string } | { nome: string }[] | null;
        }[]
      | null;
  };

  const acoes: AcaoLembrete[] = ((acoesRaw ?? []) as unknown as Join[]).map(
    (a) => {
      const neg = Array.isArray(a.negociacoes) ? a.negociacoes[0] : a.negociacoes;
      const emp = neg?.empresas;
      const empresaNome = Array.isArray(emp) ? emp[0]?.nome : emp?.nome;
      const em = neg?.emitentes;
      const emitenteNome = (Array.isArray(em) ? em[0]?.nome : em?.nome) ?? null;
      return {
        id: a.id,
        descricao: a.descricao,
        tipo: a.tipo,
        data: a.data,
        // a ação pertence ao responsável da negociação (quem vende)
        responsavelId: neg?.responsavel_id ?? a.responsavel_id,
        negociacaoId: a.negociacao_id,
        negociacaoTitulo: neg?.titulo ?? "Negociação",
        empresaNome: empresaNome ?? "—",
        emitenteNome,
        valor: Number(neg?.valor_estimado ?? 0),
        atrasada: a.data < hoje,
      };
    },
  );

  const semAcaoPor = new Map<string, number>();
  for (const n of semAcaoRaw ?? []) {
    if (!n.responsavel_id) continue;
    semAcaoPor.set(n.responsavel_id, (semAcaoPor.get(n.responsavel_id) ?? 0) + 1);
  }

  return {
    hoje,
    usuarios: (usuarios ?? []).map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      diretor: diretores.has(u.id) || u.perfil === "diretor",
      atrasadas: acoes.filter((a) => a.responsavelId === u.id && a.atrasada),
      deHoje: acoes.filter((a) => a.responsavelId === u.id && !a.atrasada),
      semAcao: semAcaoPor.get(u.id) ?? 0,
    })),
  };
}

function linhaAcao(a: AcaoLembrete, appUrl: string): string {
  return `<li style="margin:0 0 8px 0">
    <a href="${appUrl}/negociacoes/${a.negociacaoId}" style="color:#111;font-weight:600;text-decoration:none">${escaparHtml(a.descricao)}</a>
    <div style="color:#666;font-size:13px">${escaparHtml(a.emitenteNome ? `${a.empresaNome} · ${a.emitenteNome}` : a.empresaNome)} · ${escaparHtml(TIPO_LABEL[a.tipo] ?? a.tipo)} · ${formatarData(a.data)} · ${formatarMoeda(a.valor)}</div>
  </li>`;
}

function cabecalho(titulo: string, subtitulo: string): string {
  return `<div style="background:#111;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
    <div style="display:inline-block;background:#ffd200;color:#171300;font-weight:700;border-radius:999px;padding:4px 10px;font-size:12px;letter-spacing:.08em">F-LED CRM</div>
    <h1 style="margin:12px 0 2px;font-size:20px">${escaparHtml(titulo)}</h1>
    <div style="color:#bbb;font-size:13px">${escaparHtml(subtitulo)}</div>
  </div>`;
}

function envelope(conteudo: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f2f2ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a18">
  <div style="max-width:620px;margin:24px auto;background:#fff;border-radius:12px;border:1px solid #e4e4df">${conteudo}</div>
  <p style="text-align:center;color:#999;font-size:12px">Você recebe este lembrete porque tem ações pendentes no CRM.</p>
  </body></html>`;
}

export function htmlLembreteVendedor(
  u: ResumoLembrete["usuarios"][number],
  hoje: string,
): { subject: string; html: string; text: string } {
  const appUrl = getAppUrl();
  const partes: string[] = [];

  if (u.atrasadas.length > 0) {
    partes.push(`<h2 style="font-size:15px;color:#c0392b;margin:18px 0 8px">Atrasadas (${u.atrasadas.length})</h2>
      <ul style="padding-left:18px;margin:0">${u.atrasadas.map((a) => linhaAcao(a, appUrl)).join("")}</ul>`);
  }
  if (u.deHoje.length > 0) {
    partes.push(`<h2 style="font-size:15px;margin:18px 0 8px">Para hoje (${u.deHoje.length})</h2>
      <ul style="padding-left:18px;margin:0">${u.deHoje.map((a) => linhaAcao(a, appUrl)).join("")}</ul>`);
  }
  if (u.semAcao > 0) {
    partes.push(`<p style="margin:18px 0 0;color:#666;font-size:13px">${u.semAcao} negociação(ões) aberta(s) sem próxima ação. <a href="${appUrl}/hoje" style="color:#111">Definir agora</a>.</p>`);
  }
  if (partes.length === 0) {
    partes.push(`<p style="margin:18px 0 0">Nenhuma ação pendente. Bom dia de prospecção!</p>`);
  }

  const subject = `Seu dia no CRM · ${formatarData(hoje)}: ${u.atrasadas.length} atrasada(s), ${u.deHoje.length} para hoje`;
  const html = envelope(
    cabecalho(`Bom dia, ${u.nome.split(" ")[0]}`, `Suas ações de ${formatarData(hoje)}`) +
      `<div style="padding:6px 22px 22px">${partes.join("")}
       <p style="margin:22px 0 0"><a href="${appUrl}/hoje" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:600">Abrir Meu dia</a></p></div>`,
  );
  const text = [
    `Suas ações de ${formatarData(hoje)}`,
    ...u.atrasadas.map((a) => `[ATRASADA ${formatarData(a.data)}] ${a.descricao} — ${a.empresaNome}`),
    ...u.deHoje.map((a) => `[HOJE] ${a.descricao} — ${a.empresaNome}`),
    u.semAcao > 0 ? `${u.semAcao} negociação(ões) sem próxima ação.` : "",
    `${appUrl}/hoje`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}

export function htmlResumoDiretor(
  resumo: ResumoLembrete,
): { subject: string; html: string; text: string } {
  const appUrl = getAppUrl();
  const vendedores = resumo.usuarios.filter((u) => !u.diretor || u.atrasadas.length + u.deHoje.length > 0);
  const totalAtrasadas = resumo.usuarios.reduce((s, u) => s + u.atrasadas.length, 0);
  const totalHoje = resumo.usuarios.reduce((s, u) => s + u.deHoje.length, 0);

  const linhas = vendedores
    .map(
      (u) => `<tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eee">${escaparHtml(u.nome)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;color:${u.atrasadas.length > 0 ? "#c0392b" : "#1a1a18"};font-weight:${u.atrasadas.length > 0 ? 700 : 400}">${u.atrasadas.length}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${u.deHoje.length}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${u.semAcao}</td>
      </tr>`,
    )
    .join("");

  const maioresAtrasadas = resumo.usuarios
    .flatMap((u) => u.atrasadas.map((a) => ({ ...a, nome: u.nome })))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);

  const subject = `Equipe hoje · ${formatarData(resumo.hoje)}: ${totalAtrasadas} atrasada(s), ${totalHoje} para hoje`;
  const html = envelope(
    cabecalho("Resumo da equipe", `Ações pendentes em ${formatarData(resumo.hoje)}`) +
      `<div style="padding:6px 22px 22px">
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
        <thead><tr style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.08em">
          <th style="text-align:left;padding:6px">Vendedor</th><th style="text-align:right;padding:6px">Atrasadas</th><th style="text-align:right;padding:6px">Hoje</th><th style="text-align:right;padding:6px">Sem ação</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      ${
        maioresAtrasadas.length > 0
          ? `<h2 style="font-size:15px;margin:22px 0 8px">Maiores negociações com ação atrasada</h2>
             <ul style="padding-left:18px;margin:0">${maioresAtrasadas
               .map(
                 (a) => `<li style="margin:0 0 8px 0"><a href="${appUrl}/negociacoes/${a.negociacaoId}" style="color:#111;font-weight:600;text-decoration:none">${escaparHtml(a.negociacaoTitulo)}</a>
                 <div style="color:#666;font-size:13px">${escaparHtml(a.emitenteNome ? `${a.empresaNome} · ${a.emitenteNome}` : a.empresaNome)} · ${formatarMoeda(a.valor)} · ${escaparHtml(a.nome)} · desde ${formatarData(a.data)}</div></li>`,
               )
               .join("")}</ul>`
          : ""
      }
      <p style="margin:22px 0 0"><a href="${appUrl}/dashboard" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:600">Abrir dashboard</a></p>
      </div>`,
  );
  const text = [
    `Resumo da equipe ${formatarData(resumo.hoje)}`,
    ...vendedores.map((u) => `${u.nome}: ${u.atrasadas.length} atrasadas, ${u.deHoje.length} hoje, ${u.semAcao} sem ação`),
    `${appUrl}/dashboard`,
  ].join("\n");
  return { subject, html, text };
}

/**
 * Executa o lembrete: um e-mail por usuário ativo com pendências e um
 * resumo consolidado para cada diretor. Retorna contadores para o log.
 */
export async function executarLembreteDiario(supabase: Client): Promise<{
  habilitado: boolean;
  enviados: number;
  pulados: number;
  erros: string[];
}> {
  const resumo = await montarResumoDiario(supabase);
  const habilitado = emailHabilitado();
  let enviados = 0;
  let pulados = 0;
  const erros: string[] = [];

  for (const u of resumo.usuarios) {
    if (!u.email) continue;
    const temPendencia = u.atrasadas.length + u.deHoje.length + u.semAcao > 0;
    if (!temPendencia) {
      pulados += 1;
      continue;
    }
    const msg = htmlLembreteVendedor(u, resumo.hoje);
    const r = await enviarEmail({ to: u.email, ...msg });
    if (r.ok) enviados += 1;
    else if ("skipped" in r && r.skipped) pulados += 1;
    else erros.push(`${u.email}: ${r.error}`);
  }

  const diretores = resumo.usuarios.filter((u) => u.diretor && u.email);
  if (diretores.length > 0) {
    const msg = htmlResumoDiretor(resumo);
    for (const d of diretores) {
      const r = await enviarEmail({ to: d.email, ...msg });
      if (r.ok) enviados += 1;
      else if ("skipped" in r && r.skipped) pulados += 1;
      else erros.push(`${d.email}: ${r.error}`);
    }
  }

  return { habilitado, enviados, pulados, erros };
}
