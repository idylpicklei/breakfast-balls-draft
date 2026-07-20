"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch, getDevUserId } from "@/lib/api-client";
import type { AuthUser, DraftOrder, DraftSession, Roster, Tournament } from "@/lib/db/types";

interface DraftPayload {
  tournament: Tournament;
  draft_session: DraftSession;
  draft_order: (DraftOrder & { user_name: string })[];
  rosters: Roster[];
  active_user_id: string | null;
  total_picks: number;
  picks_remaining: number;
}

interface PlayerHit {
  id: string;
  name: string;
}

export default function DraftPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params.id;

  const [me, setMe] = useState<AuthUser | null>(null);
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [manualId, setManualId] = useState("");
  const [manualName, setManualName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [user, data] = await Promise.all([
      apiFetch<AuthUser>("/api/me"),
      apiFetch<DraftPayload>(`/api/draft/${tournamentId}`),
    ]);
    setMe(user);
    setDraft(data);
  }, [tournamentId]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const draftedIds = useMemo(
    () => new Set(draft?.rosters.map((r) => r.player_id) ?? []),
    [draft],
  );

  const isMyTurn =
    !!draft &&
    draft.draft_session.draft_status === "LIVE" &&
    draft.active_user_id === (me?.id ?? getDevUserId());

  async function startDraft() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/draft/${tournamentId}/start`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setBusy(false);
    }
  }

  async function makePick(playerId: string, playerName: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/draft/pick", {
        method: "POST",
        body: JSON.stringify({ tournamentId, playerId, playerName }),
      });
      setHits([]);
      setQuery("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pick failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const data = await apiFetch<{ players: PlayerHit[] }>(
        `/api/players/search?q=${encodeURIComponent(query)}&tournId=${encodeURIComponent(draft!.tournament.external_tournament_id)}&year=${encodeURIComponent(draft!.tournament.year)}`,
      );
      setHits(data.players.filter((p) => !draftedIds.has(p.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }

  if (!draft) {
    return <p className="text-[var(--muted)]">{error ?? "Loading draft…"}</p>;
  }

  const { tournament, draft_session, draft_order, rosters, active_user_id } = draft;
  const activeName =
    draft_order.find((d) => d.user_id === active_user_id)?.user_name ?? active_user_id;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Snake draft</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
            {tournament.name}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Status: {draft_session.draft_status} · Pick {Math.min(draft_session.current_pick, draft.total_picks)} /{" "}
            {draft.total_picks}
            {active_user_id ? ` · On the clock: ${activeName}` : null}
          </p>
        </div>
        <div className="flex gap-2">
          {draft_session.draft_status === "PENDING" && me?.is_admin && (
            <button
              onClick={startDraft}
              disabled={busy}
              className="bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Start draft
            </button>
          )}
          <Link
            href={`/tournaments/${tournamentId}`}
            className="border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--accent-soft)]"
          >
            Scoreboard
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <section className="grid gap-3 md:grid-cols-4">
        {draft_order.map((slot) => (
          <div
            key={slot.user_id}
            className={`border px-3 py-3 ${
              slot.user_id === active_user_id
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--line)] bg-[var(--panel)]/70"
            }`}
          >
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Slot {slot.pick_position}
            </p>
            <p className="font-semibold">{slot.user_name}</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
              {rosters
                .filter((r) => r.user_id === slot.user_id)
                .map((r) => (
                  <li key={r.player_id}>
                    #{r.pick_number} {r.player_name}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      {isMyTurn && (
        <section className="space-y-4 border border-[var(--line)] bg-[var(--panel)]/80 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Your pick</h2>
          <form onSubmit={onSearch} className="flex flex-wrap gap-2">
            <input
              className="min-w-[220px] flex-1 border border-[var(--line)] px-3 py-2"
              placeholder="Search PGA players"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="bg-[var(--ink)] px-4 py-2 text-sm text-white">
              Search
            </button>
          </form>

          {hits.length > 0 && (
            <ul className="divide-y divide-[var(--line)] border border-[var(--line)]">
              {hits.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    {p.name} <span className="text-xs text-[var(--muted)]">#{p.id}</span>
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => makePick(p.id, p.name)}
                    className="bg-[var(--accent)] px-3 py-1 text-sm text-white disabled:opacity-50"
                  >
                    Draft
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-[var(--line)] pt-4">
            <p className="text-sm text-[var(--muted)]">
              Manual pick (search cached PGA field first)
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                className="w-32 border border-[var(--line)] px-3 py-2"
                placeholder="Player ID"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
              />
              <input
                className="min-w-[180px] flex-1 border border-[var(--line)] px-3 py-2"
                placeholder="Player name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
              <button
                disabled={busy || !manualId || !manualName}
                onClick={() => makePick(manualId, manualName)}
                className="bg-[var(--fairway)] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Submit pick
              </button>
            </div>
          </div>
        </section>
      )}

      {draft_session.draft_status === "FINISHED" && (
        <p className="text-[var(--accent)]">
          Draft complete.{" "}
          <Link href={`/tournaments/${tournamentId}`} className="underline">
            Open the live scoreboard
          </Link>
          .
        </p>
      )}
    </div>
  );
}
