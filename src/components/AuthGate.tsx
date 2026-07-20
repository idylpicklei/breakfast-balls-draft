"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

const PUBLIC_PATHS = ["/login"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useAuth();
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  useEffect(() => {
    if (isPublic) return;
    if (me === null) {
      router.replace("/login");
    }
  }, [isPublic, me, router]);

  if (isPublic) {
    return children;
  }

  if (me === undefined) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  if (me === null) {
    return <p className="text-[var(--muted)]">Redirecting to login…</p>;
  }

  return children;
}
