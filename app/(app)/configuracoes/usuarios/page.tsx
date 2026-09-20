import Link from "next/link";
import { redirect } from "next/navigation";

import { ConvidarUsuarioForm } from "@/components/crm/convidar-usuario-form";
import { UsuarioAtivoToggle } from "@/components/crm/usuario-ativo-toggle";
import { UsuarioEmpresasEditor } from "@/components/crm/usuario-empresas-editor";
import { getEscopoEmpresa } from "@/lib/auth/escopo-empresa";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
import { empresasOndeEhDiretor } from "@/lib/auth/permissoes";
import { listarUsuarios } from "@/lib/actions/usuarios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function UsuariosPage() {
  const atual = await getUsuarioAtual();
  if (!atual || !atual.ehDiretorEmAlguma) {
    redirect("/hoje");
  }
  const escopo = await getEscopoEmpresa(atual);
  const dirigidas = new Set(empresasOndeEhDiretor(atual));
  const empresas = atual.empresas
    .filter((e) => dirigidas.has(e.id))
    .map((e) => ({ id: e.id, nome: e.nome }));

  const usuarios = await listarUsuarios();

  // gerentes ativos por empresa (para o select do vendedor)
  const gerentesPorEmpresa: Record<string, { id: string; nome: string }[]> = {};
  for (const e of empresas) gerentesPorEmpresa[e.id] = [];
  for (const u of usuarios) {
    if (!u.ativo) continue;
    for (const v of u.vinculos) {
      if (v.perfil === "gerente" && gerentesPorEmpresa[v.emitenteId]) {
        gerentesPorEmpresa[v.emitenteId]!.push({ id: u.id, nome: u.nome });
      }
    }
  }

  const nomeEmpresa = new Map(empresas.map((e) => [e.id, e.nome]));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <div className="mb-2 flex flex-wrap gap-3 text-sm">
          <span className="font-medium text-foreground">Usuários</span>
          <Link
            href="/configuracoes/api-keys"
            className="text-muted-foreground hover:text-foreground"
          >
            API keys
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O perfil é por empresa vendedora: a mesma pessoa pode ser diretor em
          uma empresa e vendedor (ou sem acesso) em outra. O gerente vê e edita
          as negociações da equipe dele naquela empresa; o diretor vê tudo da
          empresa. Você só altera vínculos das empresas que dirige.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Convidar</h2>
        <ConvidarUsuarioForm
          empresas={empresas}
          empresaInicial={escopo.emitenteId && dirigidas.has(escopo.emitenteId) ? escopo.emitenteId : null}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Lista</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Empresas e perfis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium align-top">
                  {u.nome}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.vinculos.map((v) => (
                      <Badge key={v.emitenteId} variant="outline" className="text-[10px]">
                        {nomeEmpresa.get(v.emitenteId) ?? "…"}: {v.perfil}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="max-w-[12rem] truncate align-top sm:max-w-none">
                  {u.email}
                </TableCell>
                <TableCell className="align-top">
                  <UsuarioEmpresasEditor
                    usuarioId={u.id}
                    vinculos={u.vinculos}
                    empresas={empresas}
                    gerentesPorEmpresa={gerentesPorEmpresa}
                    ehEuMesmo={u.id === atual.id}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={u.ativo ? "secondary" : "outline"}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right align-top">
                  <UsuarioAtivoToggle id={u.id} ativo={u.ativo} />
                </TableCell>
              </TableRow>
            ))}
            {usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Nenhum usuário ainda.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
