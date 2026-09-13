import { ContatosLista } from "@/components/crm/contatos-lista";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { createClient } from "@/lib/supabase/server";

export default async function ContatosPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const supabase = await createClient();

  const [{ data: contatosRaw }, { data: empresasRaw }] = await Promise.all([
    supabase
      .from("contatos")
      .select(
        "id, empresa_id, nome, whatsapp, email, cargo, decisor, empresas:empresa_id(id, nome, responsavel_id, arquivado_em)",
      )
      .is("arquivado_em", null)
      .order("nome"),
    supabase
      .from("empresas")
      .select("id, nome, responsavel_id")
      .is("arquivado_em", null)
      .order("nome"),
  ]);

  const contatos = (contatosRaw ?? [])
    .map((c) => {
      const emp = c.empresas as
        | {
            id: string;
            nome: string;
            responsavel_id: string | null;
            arquivado_em: string | null;
          }
        | null;
      if (!emp || emp.arquivado_em) return null;
      const podeEditar =
        usuario.perfil === "diretor" ||
        emp.responsavel_id == null ||
        emp.responsavel_id === usuario.id;
      return {
        id: c.id,
        empresaId: c.empresa_id,
        empresaNome: emp.nome,
        nome: c.nome,
        whatsapp: c.whatsapp,
        email: c.email,
        cargo: c.cargo,
        decisor: c.decisor,
        podeEditar,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);

  const empresasEditaveis = (empresasRaw ?? []).filter(
    (e) =>
      usuario.perfil === "diretor" ||
      e.responsavel_id == null ||
      e.responsavel_id === usuario.id,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-24 lg:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Contatos</h1>
        <p className="text-sm text-muted-foreground">
          Pessoas nas empresas da carteira.
        </p>
      </div>
      <ContatosLista
        contatos={contatos}
        empresas={empresasEditaveis.map((e) => ({ id: e.id, nome: e.nome }))}
      />
    </div>
  );
}
