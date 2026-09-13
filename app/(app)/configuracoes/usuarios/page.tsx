import Link from "next/link";
import { redirect } from "next/navigation";

import { ConvidarUsuarioForm } from "@/components/crm/convidar-usuario-form";
import { UsuarioAtivoToggle } from "@/components/crm/usuario-ativo-toggle";
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

/** Guard de diretor fica no layout de /configuracoes. */
export default async function UsuariosPage() {
  const usuarios = await listarUsuarios();

  return (
    <div className="flex flex-col gap-8">
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
        <h2 className="text-lg font-medium">Usuários</h2>
        <p className="text-sm text-muted-foreground">
          Convide vendedores e diretores. Sem cadastro público.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-medium">Convidar</h3>
        <ConvidarUsuarioForm />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-medium">Lista</h3>
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
