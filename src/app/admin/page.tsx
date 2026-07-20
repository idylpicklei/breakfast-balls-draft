"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import type { AuthUser, GolfTournament, Tournament } from "@/lib/db/types";
import { DEFAULT_PARTNERSHIP_TEAMS } from "@/lib/teams";

const DEFAULT_ORDER = ["MinJungKyu", "PaulHawk", "PigTank", "Dylpickle"];

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [cached, setCached] = useState<GolfTournament[]>([]);
  const [selectedTournId, setSelectedTournId] = useState("");
  const [name, setName] = useState("");
  const [order, setOrder] = useState(DEFAULT_ORDER.join(", "));
  const [idahoMembers, setIdahoMembers] = useState(
    DEFAULT_PARTNERSHIP_TEAMS[0].member_ids.join(", "),
  );
  const [oregonMembers, setOregonMembers] = useState(
    DEFAULT_PARTNERSHIP_TEAMS[1].member_ids.join(", "),
  );

  async function loadCachedSchedule(scheduleYear: string) {
    const data = await apiFetch<{ tournaments: GolfTournament[] }>(
      `/api/golf/tournaments?year=${encodeURIComponent(scheduleYear)}`,
    );
    setCached(data.tournaments);
    if (data.tournaments.length > 0 && !selectedTournId) {
      setSelectedTournId(data.tournaments[0].id);
      setName(data.tournaments[0].name);
    }
  }

  useEffect(() => {
    apiFetch<AuthUser>("/api/me")
      .then(setMe)
      .catch((err: Error) => setError(err.message));
    loadCachedSchedule(year).catch(() => undefined);
  }, [year]);

  async function syncSchedule() {
    setSyncing(true);
    setError(null);
    try {
      await apiFetch("/api/golf/sync-schedule", {
        method: "POST",
        body: JSON.stringify({ year }),
      });
      await loadCachedSchedule(year);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const draft_order = order
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const partnership_teams = [
        {
          name: "Idaho",
          member_ids: idahoMembers
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        {
          name: "Oregon",
          member_ids: oregonMembers
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      ];

      const selected = cached.find((t) => t.id === selectedTournId);

      const data = await apiFetch<{ tournament: Tournament }>("/api/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name: name || selected?.name,
          external_tournament_id: selectedTournId,
          year,
          draft_order,
          partnership_teams,
          sync_field: true,
        }),
      });
      router.push(`/tournaments/${data.tournament.id}/draft`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
          Admin
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Sync the PGA schedule, then create a league tournament from cached RapidAPI data.
        </p>
      </div>

      {me && !me.is_admin && (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Signed in as {me.name}. Admin tools are only available to Dylpickle.
        </p>
      )}

      <section className="space-y-3 border border-[var(--line)] bg-[var(--panel)]/80 p-5">
        <h2 className="font-semibold">1. Sync PGA schedule</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="w-24 border border-[var(--line)] bg-white px-3 py-2"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2026"
          />
          <button
            type="button"
            disabled={syncing || (me != null && !me.is_admin)}
            onClick={syncSchedule}
            className="border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--accent-soft)] disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync schedule"}
          </button>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {cached.length} tournaments cached for {year}.
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-4 border border-[var(--line)] bg-[var(--panel)]/80 p-5">
        <h2 className="font-semibold">2. Create league tournament</h2>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">PGA tournament</span>
          <select
            required
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
            value={selectedTournId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedTournId(id);
              const hit = cached.find((t) => t.id === id);
              if (hit) setName(hit.name);
            }}
          >
            <option value="" disabled>
              Select a cached tournament
            </option>
            {cached.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.id})
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">League display name</span>
          <input
            required
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Breakfast Balls Week 12"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Draft order (4 user ids, comma-separated)</span>
          <input
            required
            className="w-full border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </label>

        <fieldset className="space-y-3 border border-[var(--line)] bg-[var(--surface)]/60 p-4">
          <legend className="px-1 text-sm font-medium">2v2 partnership teams</legend>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Idaho members</span>
            <input
              required
              className="w-full border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs"
              value={idahoMembers}
              onChange={(e) => setIdahoMembers(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Oregon members</span>
            <input
              required
              className="w-full border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs"
              value={oregonMembers}
              onChange={(e) => setOregonMembers(e.target.value)}
            />
          </label>
          <p className="text-xs text-[var(--muted)]">
            Best foursome uses the best 4 of 12 combined golfers per side.
          </p>
        </fieldset>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={saving || !selectedTournId || (me != null && !me.is_admin)}
          className="bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create tournament"}
        </button>
      </form>
    </div>
  );
}
