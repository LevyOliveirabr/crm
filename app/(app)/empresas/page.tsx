import { BotaoExportar } from "@/components/crm/botao-exportar";
import { EmpresasLista } from "@/components/crm/empresas-lista";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ q?: string | string[]; emitente?: string | string[] }>;

function paramUnico(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const sp = await searchParams;
  const q = paramUnico(sp.q)?.trim() ?? "";

  const supabase = await createClient();
  const escopo = await getEscopoEmpresa(usuario, sp);

  let query = supabase
    .from("v_empresas")
    .select(
      "id, nome, cidade, segmento, responsavel_nome, qtd_abertas, ultimo_contato",
    )
    .order("ultimo_contato", { ascending: true, nullsFirst: true });

  if (q) {
    query = query.ilike("nome", `%${q}%`);
  }

  const [{ data: rows, error: erroView }, { data: listas }] = await Promise.all([
    query,
    supabase
      .from("listas")
      .select("valor")
      .eq("tipo", "segmento")
      .eq("ativo", true)
      .order("ordem"),
  ]);

  // Com uma empresa vendedora selecionada, os indicadores vêm só das
  // negociações dela (v_empresas agrega todas as empresas do grupo).
  const porEmpresa = new Map<string, { qtdAbertas: number; ultimoContato: string | null }>();
  if (escopo.emitenteId) {
    const { data: negs } = await supabase
      .from("v_negociacoes")
      .select("empresa_id, status, ultima_interacao")
      .eq("emitente_id", escopo.emitenteId);
    for (const n of negs ?? []) {
      if (!n.empresa_id) continue;
      const cur = porEmpresa.get(n.empresa_id) ?? { qtdAbertas: 0, ultimoContato: null };
      if (n.status === "aberta") cur.qtdAbertas += 1;
      if (n.ultima_interacao && (!cur.ultimoContato || n.ultima_interacao > cur.ultimoContato)) {
        cur.ultimoContato = n.ultima_interacao;
      }
      porEmpresa.set(n.empresa_id, cur);
    }
  }

  let listaFinal =
    !erroView && rows
      ? rows
          .filter((r): r is typeof r & { id: string; nome: string } =>
            Boolean(r.id && r.nome),
          )
          .map((r) => ({
            id: r.id,
            nome: r.nome,
            cidade: r.cidade,
            segmento: r.segmento,
            responsavelNome: r.responsavel_nome,
            qtdAbertas: escopo.emitenteId
              ? (porEmpresa.get(r.id)?.qtdAbertas ?? 0)
              : Number(r.qtd_abertas ?? 0),
            ultimoContato: escopo.emitenteId
              ? (porEmpresa.get(r.id)?.ultimoContato ?? null)
              : r.ultimo_contato,
          }))
          .sort((a, b) => {
            if (!escopo.emitenteId) return 0;
            const ad = a.ultimoContato ?? "";
            const bd = b.ultimoContato ?? "";
            if (ad === bd) return a.nome.localeCompare(b.nome, "pt-BR");
            if (!ad) return -1;
            if (!bd) return 1;
            return ad < bd ? -1 : 1;
          })
      : [];

  // Fallback se a view ainda não foi aplicada no projeto remoto
  if (erroView) {
    const { data: fallback } = await supabase
      .from("empresas")
      .select(
        "id, nome, cidade, segmento, responsavel_id, usuarios:responsavel_id(nome)",
      )
      .is("arquivado_em", null)
      .ilike("nome", q ? `%${q}%` : "%")
      .order("nome");

    listaFinal = (fallback ?? []).map((e) => {
      const resp = e.usuarios as { nome: string } | null;
      return {
        id: e.id,
        nome: e.nome,
        cidade: e.cidade,
        segmento: e.segmento,
        responsavelNome: resp?.nome ?? null,
        qtdAbertas: 0,
        ultimoContato: null,
      };
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-24 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            Carteira com último contato — abandonadas primeiro.
          </p>
        </div>
        <BotaoExportar tela="empresas" filtros={{ q: q || null }} />
      </div>
      <EmpresasLista
        empresas={listaFinal}
        segmentos={(listas ?? []).map((l) => l.valor)}
        buscaInicial={q}
      />
    </div>
  );
}
