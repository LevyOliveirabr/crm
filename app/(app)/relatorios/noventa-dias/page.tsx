import Link from "next/link";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  idsEquipeVisivel,
  listarVendedoresVisiveis,
  podeVerEquipe,
} from "@/lib/auth/equipe";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { BotaoImprimir } from "@/components/crm/botao-imprimir";
import { carregarDadosDashboard } from "@/lib/dashboard/dados";
import {
  adicionarDiasISO,
  formatarMoeda,
  formatarMoedaCurta,
  hojeISO,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function PrestacaoNoventaDiasPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;
  const escopo = await getEscopoEmpresa(usuario);
  const supabase = await createClient();
  const vendedores = await listarVendedoresVisiveis(supabase, usuario, escopo);
  const hoje = hojeISO();
  const de = adicionarDiasISO(hoje, -90);

  const dados = await carregarDadosDashboard(supabase, {
    de,
    ate: hoje,
    vendedorId: null,
    etapaIds: [],
    visao: "previsao",
    metrica: "potencial",
    ufs: [],
    origens: [],
    segmentos: [],
    tipoCliente: null,
    isDiretor: podeVerEquipe(usuario, escopo),
    equipeIds: idsEquipeVisivel(usuario, vendedores, escopo),
    emitenteId: escopo.emitenteId,
    usuarioId: usuario.id,
  });

  const k = dados.kpis;

  return (
    <article className="mx-auto max-w-3xl space-y-6 p-6 print:p-0">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4 print:border-black">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase">
            F-Led · Prestação de contas
          </p>
          <h1 className="font-heading text-2xl font-semibold">Últimos 90 dias</h1>
          <p className="text-sm text-muted-foreground">
            {escopo.emitente?.nome ?? "Todas as empresas"} · {de.split("-").reverse().join("/")} a{" "}
            {hoje.split("-").reverse().join("/")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 print:hidden">
          <Link href="/relatorios" className="text-sm font-medium underline">
            Voltar
          </Link>
          <BotaoImprimir>Imprimir / PDF</BotaoImprimir>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <Bloco titulo="Pipeline aberto" valor={formatarMoeda(k.pipelineTotal)} />
        <Bloco titulo="Vendido no mês" valor={formatarMoeda(k.vendidoMes)} />
        <Bloco titulo="Faturado no mês" valor={formatarMoeda(k.faturadoMes)} />
        <Bloco
          titulo="Meta do mês"
          valor={k.metaMes > 0 ? formatarMoeda(k.metaMes) : "Sem meta"}
        />
        <Bloco
          titulo="Previsão vencida"
          valor={`${formatarMoedaCurta(k.previsaoVencida)} · ${k.qtdPrevisaoVencida}`}
        />
        <Bloco titulo="Top 10 do pipeline" valor={`${k.top10Pct}%`} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Por estado</h2>
        <ul className="space-y-1 text-sm">
          {dados.porUf.slice(0, 10).map((u) => (
            <li key={u.chave} className="flex justify-between gap-3">
              <span>{u.label}</span>
              <span className="tabular-nums">{formatarMoeda(u.valor)}</span>
            </li>
          ))}
          {dados.porUf.length === 0 ? (
            <li className="text-muted-foreground">Sem negócios abertos.</li>
          ) : null}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground print:text-black">
        As 10 maiores oportunidades abertas representam {k.top10Pct}% do pipeline.
      </p>
    </article>
  );
}

function Bloco({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border p-3 print:border-black">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="font-heading text-lg font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
