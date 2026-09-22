"use client";

export function BotaoImprimir({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center rounded-lg border border-input px-3 text-sm font-medium print:hidden"
    >
      {children}
    </button>
  );
}
