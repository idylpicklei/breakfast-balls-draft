"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { AuthUser, Tournament } from "@/lib/db/types";

export default function HomePage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AuthUser>("/api/me")
      .then(setMe)
      .catch(() => undefined);
    apiFetch<{ tournaments: Tournament[] }>("/api/tournaments")
      .then((data) => setTournaments(data.tournaments))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-none border-b border-[var(--line)] pb-10 pt-4">
        <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-[var(--ink)] md:text-7xl">
          Breakfast Balls
        </p>

      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            Tournaments
          </h2>
          {me?.is_admin && (
            <Link
              href="/admin"
              className="bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--fairway)]"
            >
              New tournament
            </Link>
          )}
        </div>

        {loading && <p className="text-[var(--muted)]">Loading…</p>}
        {error && (
          <p className="text-red-700">
            {error}. Apply local migrations (`npm run db:migrate:local`) and set a Dev user.
          </p>
        )}

        {!loading && !error && tournaments.length === 0 && (
          <p className="text-[var(--muted)]">
            {me?.is_admin
              ? "No tournaments yet. Create one in Admin."
              : "No tournaments yet."}
          </p>
        )}

        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)] bg-[var(--panel)]/70">
          {tournaments.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <p className="font-semibold text-[var(--ink)]">{t.name}</p>
                <p className="text-sm text-[var(--muted)]">
                  {t.status} · PGA {t.external_tournament_id} ({t.year})
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/tournaments/${t.id}/draft`}
                  className="border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-[var(--accent-soft)]"
                >
                  Draft
                </Link>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="bg-[var(--ink)] px-3 py-1.5 text-sm text-white hover:bg-[var(--accent)]"
                >
                  Scoreboard
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
