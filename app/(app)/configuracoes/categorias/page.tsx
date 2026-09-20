import { CategoriasConfigClient } from "@/components/crm/categorias-config-client";
import { listarCategorias } from "@/lib/actions/emitentes";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { empresasOndeEhDiretor } from "@/lib/auth/permissoes";
import { Secao } from "@/components/crm/pagina";

export default async function CategoriasPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;
  const escopo = await getEscopoEmpresa(usuario);
  const dirigidas = new Set(empresasOndeEhDiretor(usuario));
  const emitentes = usuario.empresas
    .filter((e) => dirigidas.has(e.id))
    .map((e) => ({ id: e.id, nome: e.nome }));
  const categorias = (await listarCategorias(escopo.emitenteId)).filter((c) =>
    dirigidas.has(c.emitente_id),
  );

  return (
    <Secao titulo="Categorias de produto">
      <p className="mb-4 text-sm text-muted-foreground">
        Agrupam os produtos de cada empresa vendedora e podem ter um catálogo
        próprio, que aparece nos links da proposta comercial.
        {escopo.emitente ? ` Mostrando: ${escopo.emitente.nome}.` : ""}
      </p>
      <CategoriasConfigClient
        categorias={categorias}
        emitentes={emitentes}
        emitenteInicial={
          escopo.emitenteId && dirigidas.has(escopo.emitenteId)
            ? escopo.emitenteId
            : null
        }
      />
    </Secao>
  );
}
