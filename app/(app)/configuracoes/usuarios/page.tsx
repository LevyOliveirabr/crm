import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { ConvidarUsuarioForm } from "@/components/crm/convidar-usuario-form";
import { Secao } from "@/components/crm/pagina";
import { UsuarioAtivoToggle } from "@/components/crm/usuario-ativo-toggle";
import { UsuarioEditarDialog } from "@/components/crm/usuario-editar-dialog";
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
import { Button } from "@/components/ui/button";

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
    <>
      <Secao titulo="Convidar" meta="o perfil é por empresa vendedora">
        <p className="mb-4 text-sm text-muted-foreground">
          A mesma pessoa pode ser diretor em uma empresa e vendedor (ou sem
          acesso) em outra. O gerente vê e edita as negociações da equipe dele
          naquela empresa; o diretor vê tudo da empresa. Você só altera vínculos
          das empresas que dirige.
        </p>
        <ConvidarUsuarioForm
          empresas={empresas}
          empresaInicial={
            escopo.emitenteId && dirigidas.has(escopo.emitenteId)
              ? escopo.emitenteId
              : null
          }
        />
      </Secao>

      <Secao
        titulo="Usuários"
        meta={`${usuarios.length} ${usuarios.length === 1 ? "usuário" : "usuários"}`}
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            nativeButton={false}
            render={<Link href="/configuracoes/api-keys" />}
          >
            <KeyRound className="size-4" />
            API keys
          </Button>
        }
        semPadding
      >
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
                      <Badge
                        key={v.emitenteId}
                        variant="outline"
                        className="text-[10px]"
                      >
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
                  <div className="flex flex-col items-end gap-1">
                    <UsuarioEditarDialog
                      usuario={{
                        id: u.id,
                        nome: u.nome,
                        email: u.email,
                        cargo: u.cargo,
                        telefone: u.telefone,
                        whatsapp: u.whatsapp,
                        linkedin: u.linkedin,
                      }}
                    />
                    <UsuarioAtivoToggle id={u.id} ativo={u.ativo} />
                  </div>
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
      </Secao>
    </>
  );
}
