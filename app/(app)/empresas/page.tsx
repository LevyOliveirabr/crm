import { EmpresasLista } from "@/components/crm/empresas-lista";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ q?: string | string[] }>;

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
            qtdAbertas: Number(r.qtd_abertas ?? 0),
            ultimoContato: r.ultimo_contato,
          }))
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
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Carteira com último contato — abandonadas primeiro.
        </p>
      </div>
      <EmpresasLista
        empresas={listaFinal}
        segmentos={(listas ?? []).map((l) => l.valor)}
        buscaInicial={q}
      />
    </div>
  );
}
