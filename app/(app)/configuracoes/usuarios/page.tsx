import { redirect } from "next/navigation";

import { ConvidarUsuarioForm } from "@/components/crm/convidar-usuario-form";
import { UsuarioAtivoToggle } from "@/components/crm/usuario-ativo-toggle";
import { getUsuarioAtual } from "@/lib/auth/get-usuario-atual";
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
  if (!atual || atual.perfil !== "diretor") {
    redirect("/hoje");
  }

  const usuarios = await listarUsuarios();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Convide vendedores e diretores. Sem cadastro público.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Convidar</h2>
        <ConvidarUsuarioForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Lista</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell className="max-w-[12rem] truncate sm:max-w-none">
                  {u.email}
                </TableCell>
                <TableCell className="capitalize">{u.perfil}</TableCell>
                <TableCell>
                  <Badge variant={u.ativo ? "secondary" : "outline"}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
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
