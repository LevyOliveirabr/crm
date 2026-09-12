"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEAL_STAGES,
  dealStageClasses,
  formatCurrency,
} from "@/lib/crm";

type DealRow = {
  id: string;
  title: string;
  value: number;
  stage: string;
  contactId: string | null;
  contact: { id: string; name: string } | null;
};

type ContactOption = { id: string; name: string };

type FormState = {
  title: string;
  value: string;
  stage: string;
  contactId: string;
};

const emptyForm: FormState = {
  title: "",
  value: "",
  stage: "Lead",
  contactId: "",
};

export function DealsClient({
  initialDeals,
  contacts,
}: {
  initialDeals: DealRow[];
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalValue = initialDeals.reduce((sum, d) => sum + d.value, 0);

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          value: Number(form.value || 0),
          stage: form.stage,
          contactId: form.contactId || null,
        }),
      });
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

  async function moveStage(deal: DealRow, stage: string) {
    if (stage === deal.stage) return;
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (res.ok) router.refresh();
  }

  async function handleDelete(deal: DealRow) {
    if (!confirm(`Delete deal "${deal.title}"?`)) return;
    const res = await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {initialDeals.length} deals · {formatCurrency(totalValue)} total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <span className="text-lg leading-none">+</span> New deal
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {DEAL_STAGES.map((stage) => {
          const stageDeals = initialDeals.filter((d) => d.stage === stage);
          const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
          return (
            <div
              key={stage}
              className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${dealStageClasses(
                    stage
                  )}`}
                >
                  {stage}
                </span>
                <span className="text-xs text-zinc-500">
                  {stageDeals.length}
                </span>
              </div>
              <p className="px-1 mb-3 text-xs font-medium text-zinc-500">
                {formatCurrency(stageValue)}
              </p>
              <div className="space-y-2 min-h-[40px]">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">
                        {deal.title}
                      </p>
                      <button
                        onClick={() => handleDelete(deal)}
                        className="text-zinc-300 hover:text-rose-500 text-sm leading-none"
                        aria-label="Delete deal"
                        title="Delete deal"
                      >
                        ×
                      </button>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">
                      {formatCurrency(deal.value)}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {deal.contact?.name ?? "Unassigned"}
                    </p>
                    <select
                      value={deal.stage}
                      onChange={(e) => moveStage(deal, e.target.value)}
                      className="mt-2 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600 outline-none focus:border-indigo-400"
                    >
                      {DEAL_STAGES.map((s) => (
                        <option key={s} value={s}>
                          Move to {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {stageDeals.length === 0 && (
                  <p className="text-xs text-zinc-400 text-center py-4">
                    No deals
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-900/40"
            onClick={() => setModalOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New deal</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Title <span className="text-rose-500">*</span>
                </span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">
                    Value (USD)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={form.value}
                    onChange={(e) =>
                      setForm({ ...form, value: e.target.value })
                    }
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">
                    Stage
                  </span>
                  <select
                    value={form.stage}
                    onChange={(e) =>
                      setForm({ ...form, stage: e.target.value })
                    }
                    className={`mt-1 ${inputClass}`}
                  >
                    {DEAL_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Contact
                </span>
                <select
                  value={form.contactId}
                  onChange={(e) =>
                    setForm({ ...form, contactId: e.target.value })
                  }
                  className={`mt-1 ${inputClass}`}
                >
                  <option value="">Unassigned</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

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
                  {saving ? "Saving…" : "Create deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
