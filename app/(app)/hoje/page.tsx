import { Suspense } from "react";
import Link from "next/link";

import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import {
  listarVendedoresVisiveis,
  podeVerEquipe,
  resolverFiltroVendedor,
} from "@/lib/auth/equipe";
import { aplicarEscopoEmitente, getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { carregarDadosFormNegociacao } from "@/lib/actions/form-negociacao";
import {
  formatarMoeda,
  formatarData,
  hojeISO,
  mesPorExtenso,
  inicioMesAtualISO,
  inicioProximoMesISO,
  adicionarDiasISO,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { BotaoExportar } from "@/components/crm/botao-exportar";
import { BotaoFlutuanteNovaNegociacao } from "@/components/crm/botao-flutuante-nova-negociacao";
import {
  HojeInterativo,
  type AcaoHojeItem,
  type NegociacaoSemAcaoItem,
} from "@/components/crm/hoje-interativo";
import {
  BarraFiltros,
  CampoFiltro,
  EstadoVazio,
  Pagina,
  PaginaCabecalho,
  Secao,
  Tile,
  Tiles,
} from "@/components/crm/pagina";
import { SeletorVendedor } from "@/components/crm/seletor-vendedor";

type SearchParams = Promise<{
  emitente?: string | string[]; vendedor?: string | string[] }>;

function paramUnico(
  valor: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export default async function HojePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const sp = await searchParams;
  const vendedorParam = paramUnico(sp.vendedor);

  const supabase = await createClient();
  const hoje = hojeISO();
  const inicioMes = inicioMesAtualISO();
  const fimMes = inicioProximoMesISO(hoje);

  const escopo = await getEscopoEmpresa(usuario, sp);
  const vendedores = await listarVendedoresVisiveis(supabase, usuario, escopo);
  const filtrarVendedor = resolverFiltroVendedor(usuario, vendedores, vendedorParam, escopo);

  const [{ data: configRow }, dadosNova] =
    await Promise.all([
      supabase
        .from("config")
        .select("valor")
        .eq("chave", "alerta_validade_orcamento_dias")
        .maybeSingle(),
      carregarDadosFormNegociacao(),
    ]);

  const alertaDias = Math.max(
    1,
    Number.parseInt(configRow?.valor ?? "3", 10) || 3,
  );
  const validadeLimite = adicionarDiasISO(hoje, alertaDias);

  // --- Números (aberto / vendido / perdido) ---
  let abertoQuery = supabase
    .from("v_negociacoes")
    .select("valor_estimado")
    .eq("status", "aberta");
  abertoQuery = aplicarEscopoEmitente(abertoQuery, escopo);
  if (filtrarVendedor) {
    abertoQuery = abertoQuery.eq("responsavel_id", filtrarVendedor);
  }
  const { data: abertas } = await abertoQuery;

  const aberto = (abertas ?? []).reduce(
    (acc, row) => acc + Number(row.valor_estimado ?? 0),
    0,
  );

  let vendidoQuery = supabase
    .from("negociacoes")
    .select("valor_final")
    .eq("status", "vendida")
    .is("arquivado_em", null)
    .gte("fechado_em", `${inicioMes}T00:00:00-03:00`)
    .lt("fechado_em", `${fimMes}T00:00:00-03:00`);
  vendidoQuery = aplicarEscopoEmitente(vendidoQuery, escopo);
  if (filtrarVendedor) {
    vendidoQuery = vendidoQuery.eq("responsavel_id", filtrarVendedor);
  }
  const { data: vendas } = await vendidoQuery;
  const vendido = (vendas ?? []).reduce(
    (acc, row) => acc + Number(row.valor_final ?? 0),
    0,
  );

  let perdidoQuery = supabase
    .from("negociacoes")
    .select("valor_estimado")
    .eq("status", "perdida")
    .is("arquivado_em", null)
    .gte("fechado_em", `${inicioMes}T00:00:00-03:00`)
    .lt("fechado_em", `${fimMes}T00:00:00-03:00`);
  perdidoQuery = aplicarEscopoEmitente(perdidoQuery, escopo);
  if (filtrarVendedor) {
    perdidoQuery = perdidoQuery.eq("responsavel_id", filtrarVendedor);
  }
  const { data: perdas } = await perdidoQuery;
  const perdido = (perdas ?? []).reduce(
    (acc, row) => acc + Number(row.valor_estimado ?? 0),
    0,
  );

  // --- Ações pendentes (atrasadas + hoje) ---
  let acoesQuery = supabase
    .from("acoes")
    .select(
      `
      id,
      descricao,
      tipo,
      data,
      negociacao_id,
      negociacoes!inner (
        id,
        status,
        arquivado_em,
        responsavel_id,
        empresas ( nome )
      )
    `,
    )
    .is("concluida_em", null)
    .lte("data", hoje)
    .eq("negociacoes.status", "aberta")
    .is("negociacoes.arquivado_em", null)
    .order("data", { ascending: true });

  acoesQuery = aplicarEscopoEmitente(acoesQuery, escopo, "negociacoes.emitente_id");
  if (filtrarVendedor) {
    acoesQuery = acoesQuery.eq("negociacoes.responsavel_id", filtrarVendedor);
  }

  const { data: acoesRaw } = await acoesQuery;

  type AcaoJoin = {
    id: string;
    descricao: string;
    tipo: AcaoHojeItem["tipo"];
    data: string;
    negociacao_id: string;
    negociacoes:
      | {
          id: string;
          status: string;
          arquivado_em: string | null;
          responsavel_id: string;
          empresas: { nome: string } | { nome: string }[] | null;
        }
      | {
          id: string;
          status: string;
          arquivado_em: string | null;
          responsavel_id: string;
          empresas: { nome: string } | { nome: string }[] | null;
        }[]
      | null;
  };

  function empresaDe(join: AcaoJoin["negociacoes"]): string {
    const neg = Array.isArray(join) ? join[0] : join;
    if (!neg) return "—";
    const emp = neg.empresas;
    if (!emp) return "—";
    if (Array.isArray(emp)) return emp[0]?.nome ?? "—";
    return emp.nome ?? "—";
  }

  const acoes: AcaoHojeItem[] = ((acoesRaw ?? []) as unknown as AcaoJoin[]).map(
    (a) => ({
      id: a.id,
      descricao: a.descricao,
      tipo: a.tipo,
      data: a.data,
      negociacaoId: a.negociacao_id,
      empresaNome: empresaDe(a.negociacoes),
      atrasada: a.data < hoje,
    }),
  );

  const atrasadas = acoes.filter((a) => a.atrasada);
  const deHoje = acoes.filter((a) => !a.atrasada);

  // --- Negociações sem ação ---
  let semAcaoQuery = supabase
    .from("v_negociacoes")
    .select("id, titulo, empresa_nome")
    .eq("status", "aberta")
    .eq("sem_acao", true)
    .order("atualizado_em", { ascending: false });
  semAcaoQuery = aplicarEscopoEmitente(semAcaoQuery, escopo);
  if (filtrarVendedor) {
    semAcaoQuery = semAcaoQuery.eq("responsavel_id", filtrarVendedor);
  }
  const { data: semAcaoRaw } = await semAcaoQuery;
  const semAcao: NegociacaoSemAcaoItem[] = (semAcaoRaw ?? []).map((n) => ({
    id: n.id!,
    titulo: n.titulo ?? "Sem título",
    empresaNome: n.empresa_nome ?? "—",
  }));

  // --- Orçamentos vencendo ---
  let orcQuery = supabase
    .from("orcamentos")
    .select(
      `
      id,
      numero,
      valor,
      validade,
      negociacao_id,
      negociacoes!inner (
        id,
        titulo,
        status,
        arquivado_em,
        responsavel_id,
        empresas ( nome )
      )
    `,
    )
    .eq("situacao", "enviado")
    .not("validade", "is", null)
    .gte("validade", hoje)
    .lte("validade", validadeLimite)
    .eq("negociacoes.status", "aberta")
    .is("negociacoes.arquivado_em", null)
    .order("validade", { ascending: true });

  if (filtrarVendedor) {
    orcQuery = orcQuery.eq("negociacoes.responsavel_id", filtrarVendedor);
  }

  const { data: orcRaw } = await orcQuery;

  type NegJoin = {
    id: string;
    titulo?: string | null;
    status: string;
    arquivado_em: string | null;
    responsavel_id: string;
    empresas: { nome: string } | { nome: string }[] | null;
  };

  type OrcJoin = {
    id: string;
    numero: string | null;
    valor: number;
    validade: string | null;
    negociacao_id: string;
    negociacoes: NegJoin | NegJoin[] | null;
  };

  function tituloNeg(join: OrcJoin["negociacoes"]): string {
    const neg = Array.isArray(join) ? join[0] : join;
    return neg?.titulo ?? "Negociação";
  }

  const orcamentos = ((orcRaw ?? []) as unknown as OrcJoin[]).map((o) => ({
    id: o.id,
    numero: o.numero,
    valor: Number(o.valor ?? 0),
    validade: o.validade,
    negociacaoId: o.negociacao_id,
    empresaNome: empresaDe(o.negociacoes),
    titulo: tituloNeg(o.negociacoes),
  }));

  const dataHoje = new Date(`${hoje}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const podeEquipe = podeVerEquipe(usuario, escopo);

  return (
    <Pagina className="pb-20">
      <PaginaCabecalho
        titulo="Meu dia"
        subtitulo={dataHoje}
        descricao="Ações atrasadas, ações de hoje, negociações sem próximo passo e orçamentos vencendo."
        acoes={<BotaoExportar tela="acoes" filtros={{ vendedor: filtrarVendedor }} />}
      />

      {podeEquipe ? (
        <BarraFiltros>
          <Suspense fallback={null}>
            <SeletorVendedor vendedores={vendedores} valor={filtrarVendedor} />
          </Suspense>
          <CampoFiltro label="Empresa">
            <p className="flex h-9 items-center text-sm font-medium">
              {escopo.emitente?.nome ?? "Todas as empresas"}
            </p>
          </CampoFiltro>
        </BarraFiltros>
      ) : null}

      <Tiles colunas={3}>
        <Tile label="Aberto" valor={formatarMoeda(aberto)} detalhe="negociações abertas" />
        <Tile
          label="Vendido no mês"
          valor={formatarMoeda(vendido)}
          detalhe={mesPorExtenso(inicioMes)}
          tom="ok"
        />
        <Tile
          label="Perdido no mês"
          valor={formatarMoeda(perdido)}
          detalhe={mesPorExtenso(inicioMes)}
          tom="ruim"
        />
      </Tiles>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <HojeInterativo atrasadas={atrasadas} deHoje={deHoje} semAcao={semAcao} />

        <Secao
          titulo="Orçamentos vencendo"
          meta={`próximos ${alertaDias} dias`}
          className="lg:col-start-2"
        >
          {orcamentos.length === 0 ? (
            <EstadoVazio texto="Nenhum orçamento vencendo." compacto />
          ) : (
            <ul className="divide-y divide-border">
              {orcamentos.map((o) => (
                <li key={o.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/orcamentos/${o.id}`}
                    className="block text-sm font-medium hover:underline"
                  >
                    {o.numero ? `Orçamento ${o.numero}` : o.titulo}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {o.empresaNome}
                    <span className="mx-1 opacity-50">·</span>
                    <span className="tabular-nums">{formatarMoeda(o.valor)}</span>
                    <span className="mx-1 opacity-50">·</span>
                    validade {o.validade ? formatarData(o.validade) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>

      {dadosNova.ok ? (
        <BotaoFlutuanteNovaNegociacao dados={dadosNova.dados} />
      ) : null}
    </Pagina>
  );
}
