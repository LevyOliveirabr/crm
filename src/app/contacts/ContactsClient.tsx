"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CONTACT_STATUSES,
  contactStatusClasses,
  initials,
} from "@/lib/crm";

type ContactRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  status: string;
  notes: string | null;
  _count?: { deals: number };
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  status: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  title: "",
  status: "Lead",
  notes: "",
};

export function ContactsClient({
  initialContacts,
}: {
  initialContacts: ContactRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialContacts;
    return initialContacts.filter((c) =>
      [c.name, c.email, c.company, c.title]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [initialContacts, query]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(contact: ContactRow) {
    setEditing(contact);
    setForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone ?? "",
      company: contact.company ?? "",
      title: contact.title ?? "",
      status: contact.status,
      notes: contact.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editing ? `/api/contacts/${editing.id}` : "/api/contacts",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }
      setModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contact: ContactRow) {
    if (!confirm(`Delete ${contact.name}?`)) return;
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {initialContacts.length} total contacts
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <span className="text-lg leading-none">+</span> New contact
        </button>
      </header>

      <div className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or company…"
          className="w-full sm:w-80 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50">
            <tr>
              <Th>Name</Th>
              <Th>Company</Th>
              <Th>Status</Th>
              <Th>Deals</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-zinc-400"
                >
                  No contacts match your search.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-zinc-500 truncate">
                          {c.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{c.company ?? "—"}</p>
                    <p className="text-xs text-zinc-500">{c.title ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${contactStatusClasses(
                        c.status
                      )}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {c._count?.deals ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="ml-4 text-sm font-medium text-rose-600 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal
          title={editing ? "Edit contact" : "New contact"}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" required>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Email" required>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Company">
                <input
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Title">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={inputClass}
                >
                  {CONTACT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
              />
            </Field>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 ${className}`}
    >
      {children}
    </th>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-zinc-900/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
