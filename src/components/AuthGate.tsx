"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

const PUBLIC_PATHS = ["/login"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      setReady(true);
      return;
    }

    let cancelled = false;
    apiFetch("/api/me")
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return children;
}
