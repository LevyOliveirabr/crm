"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";

import { atualizarUsuarioAction } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

type Props = {
  usuario: {
    id: string;
    nome: string;
    email: string;
    cargo: string | null;
    telefone: string | null;
    whatsapp: string | null;
    linkedin: string | null;
  };
};

export function UsuarioEditarDialog({ usuario }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    nome: usuario.nome,
    email: usuario.email,
    cargo: usuario.cargo ?? "",
    telefone: usuario.telefone ?? "",
    whatsapp: usuario.whatsapp ?? "",
    linkedin: usuario.linkedin ?? "",
  });

  function abrir() {
    setForm({
      nome: usuario.nome,
      email: usuario.email,
      cargo: usuario.cargo ?? "",
      telefone: usuario.telefone ?? "",
      whatsapp: usuario.whatsapp ?? "",
      linkedin: usuario.linkedin ?? "",
    });
    setOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="rounded-full"
        onClick={abrir}
        title="Editar usuário"
      >
        <Pencil className="size-3.5" />
        Editar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await atualizarUsuarioAction({
                  id: usuario.id,
                  nome: form.nome,
                  email: form.email,
                  cargo: form.cargo || null,
                  telefone: form.telefone || null,
                  whatsapp: form.whatsapp || null,
                  linkedin: form.linkedin || null,
                });
                if (res.error) {
                  toast.add({ title: res.error, type: "error" });
                  return;
                }
                toast.add({
                  title: res.message ?? "Usuário atualizado",
                  type: "success",
                });
                setOpen(false);
              });
            }}
          >
            <label className="block text-sm">
              Nome *
              <Input
                className="mt-1"
                value={form.nome}
                required
                onChange={(ev) =>
                  setForm((f) => ({ ...f, nome: ev.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              E-mail *
              <Input
                className="mt-1"
                type="email"
                value={form.email}
                required
                onChange={(ev) =>
                  setForm((f) => ({ ...f, email: ev.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              Cargo
              <Input
                className="mt-1"
                value={form.cargo}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, cargo: ev.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              Telefone
              <Input
                className="mt-1"
                value={form.telefone}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, telefone: ev.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              WhatsApp (DDI+número)
              <Input
                className="mt-1"
                value={form.whatsapp}
                placeholder="5531999998888"
                onChange={(ev) =>
                  setForm((f) => ({
                    ...f,
                    whatsapp: ev.target.value.replace(/\D/g, ""),
                  }))
                }
              />
            </label>
            <label className="block text-sm">
              LinkedIn
              <Input
                className="mt-1"
                value={form.linkedin}
                placeholder="https://linkedin.com/in/..."
                onChange={(ev) =>
                  setForm((f) => ({ ...f, linkedin: ev.target.value }))
                }
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
