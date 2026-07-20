"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api-client";
import type { AuthUser } from "@/lib/db/types";

export default function LoginPage() {
  const router = useRouter();
  const { setMe } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setMe(data.user);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-8 pt-12">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Breakfast Balls</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
          Log in
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Use your league username and password.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 border border-[var(--line)] bg-[var(--panel)]/80 p-5">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Username</span>
          <input
            required
            autoComplete="username"
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Password</span>
          <input
            required
            type="password"
            autoComplete="current-password"
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
