import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  DEAL_STAGES,
  OPEN_STAGES,
  contactStatusClasses,
  dealStageClasses,
  formatCurrency,
  initials,
} from "@/lib/crm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [contacts, deals] = await Promise.all([
    prisma.contact.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.deal.findMany({
      orderBy: { createdAt: "desc" },
      include: { contact: true },
    }),
  ]);

  const activeContacts = contacts.filter((c) => c.status === "Active").length;
  const openPipeline = deals
    .filter((d) => OPEN_STAGES.includes(d.stage as (typeof OPEN_STAGES)[number]))
    .reduce((sum, d) => sum + d.value, 0);
  const wonValue = deals
    .filter((d) => d.stage === "Won")
    .reduce((sum, d) => sum + d.value, 0);

  const stageCounts = DEAL_STAGES.map((stage) => ({
    stage,
    count: deals.filter((d) => d.stage === stage).length,
    value: deals
      .filter((d) => d.stage === stage)
      .reduce((sum, d) => sum + d.value, 0),
  }));
  const maxStageCount = Math.max(1, ...stageCounts.map((s) => s.count));

  const stats = [
    { label: "Total contacts", value: String(contacts.length) },
    { label: "Active contacts", value: String(activeContacts) },
    { label: "Open pipeline", value: formatCurrency(openPipeline) },
    { label: "Closed won", value: formatCurrency(wonValue) },
  ];

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Overview of your contacts and sales pipeline.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-zinc-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Pipeline by stage</h2>
            <Link
              href="/deals"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View
            </Link>
          </div>
          <ul className="space-y-3">
            {stageCounts.map((s) => (
              <li key={s.stage}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${dealStageClasses(
                      s.stage
                    )}`}
                  >
                    {s.stage}
                  </span>
                  <span className="text-zinc-500">
                    {s.count} · {formatCurrency(s.value)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(s.count / maxStageCount) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent contacts</h2>
            <Link
              href="/contacts"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View
            </Link>
          </div>
          {contacts.length === 0 ? (
            <EmptyState label="No contacts yet." />
          ) : (
            <ul className="space-y-3">
              {contacts.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {c.company ?? c.email}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${contactStatusClasses(
                      c.status
                    )}`}
                  >
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent deals</h2>
            <Link
              href="/deals"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View
            </Link>
          </div>
          {deals.length === 0 ? (
            <EmptyState label="No deals yet." />
          ) : (
            <ul className="space-y-3">
              {deals.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {d.contact?.name ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatCurrency(d.value)}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${dealStageClasses(
                        d.stage
                      )}`}
                    >
                      {d.stage}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="h-9 w-9 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
      {initials(name)}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-zinc-400 py-6 text-center">{label}</p>;
}
