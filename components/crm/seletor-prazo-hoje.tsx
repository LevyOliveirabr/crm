"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { CampoFiltro } from "@/components/crm/pagina";
import { PRAZOS_HOJE, type PrazoHojeId } from "@/lib/hoje-prazo";

export function SeletorPrazoHoje({
  prazo,
  de,
  ate,
}: {
  prazo: PrazoHojeId;
  de: string;
  ate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function navegar(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <CampoFiltro label="Prazo">
        <select
          className="flex h-9 w-full min-w-[10rem] rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
          value={prazo}
          onChange={(e) => {
            const id = e.target.value as PrazoHojeId;
            if (id === "custom") {
              navegar({ prazo: "custom", de, ate });
            } else {
              navegar({ prazo: id, de: null, ate: null });
            }
          }}
        >
          {PRAZOS_HOJE.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </CampoFiltro>
      {prazo === "custom" ? (
        <>
          <CampoFiltro label="De">
            <input
              type="date"
              className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
              value={de}
              onChange={(e) => navegar({ prazo: "custom", de: e.target.value, ate })}
            />
          </CampoFiltro>
          <CampoFiltro label="Até">
            <input
              type="date"
              className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
              value={ate}
              onChange={(e) => navegar({ prazo: "custom", de, ate: e.target.value })}
            />
          </CampoFiltro>
        </>
      ) : null}
    </div>
  );
}
