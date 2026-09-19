"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Quando o convite/recovery redireciona com tokens no hash (fluxo implícito),
 * o browser client persiste a sessão e recarregamos a página.
 */
export function AuthHashBridge() {
  const router = useRouter();
  const tentou = useRef(false);

  useEffect(() => {
    if (tentou.current) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (
      !hash.includes("access_token") &&
      !hash.includes("type=recovery") &&
      !hash.includes("type=invite")
    ) {
      tentou.current = true;
      return;
    }

    tentou.current = true;
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.history.replaceState(null, "", window.location.pathname);
        router.refresh();
      }
    });
  }, [router]);

  return null;
}
