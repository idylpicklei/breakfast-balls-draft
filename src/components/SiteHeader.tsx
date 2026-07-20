"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api-client";

export function SiteHeader() {
  const router = useRouter();
  const { me, setMe } = useAuth();

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear local session even if the request fails
    }
    setMe(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-[var(--line)] bg-[var(--surface)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]"
        >
          Breakfast Balls
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {me && (
            <>
              <Link href="/" className="text-[var(--muted)] hover:text-[var(--ink)]">
                Tournaments
              </Link>
              {me.is_admin && (
                <Link href="/admin" className="text-[var(--muted)] hover:text-[var(--ink)]">
                  Admin
                </Link>
              )}
              <span className="text-[var(--muted)]">{me.name}</span>
              <button
                type="button"
                onClick={logout}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Log out
              </button>
            </>
          )}
          {me === null && (
            <Link href="/login" className="text-[var(--muted)] hover:text-[var(--ink)]">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
