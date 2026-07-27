"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { AuthUser, DraftOrder, DraftSession, Roster, Tournament } from "@/lib/db/types";

interface PlayerHit {
  id: string;
  name: string;
  status?: string | null;
  fedex_rank?: number | null;
}

interface QueueEntry {
  player_id: string;
  sort_order: number;
  name: string;
}

interface DraftPayload {
  tournament: Tournament;
  draft_session: DraftSession;
  draft_order: (DraftOrder & { user_name: string })[];
  rosters: Roster[];
  available_players: PlayerHit[];
  active_user_id: string | null;
  total_picks: number;
  picks_remaining: number;
  pick_clock_seconds?: number;
  pick_deadline_at?: string | null;
  my_queue?: QueueEntry[];
  autodraft_enabled?: boolean;
}

interface AutoPickResult {
  ok?: boolean;
  skipped?: boolean;
  auto_picked?: boolean;
  player_name?: string;
  user_id?: string;
  from_queue?: boolean;
}

const LIVE_POLL_MS = 2000;
const PENDING_POLL_MS = 4000;

function formatCountdown(deadlineIso: string | null | undefined): string | null {
  if (!deadlineIso) return null;
  const ms = Date.parse(deadlineIso) - Date.now();
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isDeadlineExpired(deadlineIso: string | null | undefined): boolean {
  if (!deadlineIso) return false;
  return Date.now() >= Date.parse(deadlineIso);
}

export default function DraftPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params.id;

  const [me, setMe] = useState<AuthUser | null>(null);
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [turnFlash, setTurnFlash] = useState(false);
  const [clockLabel, setClockLabel] = useState<string | null>(null);
  const [autoPickMessage, setAutoPickMessage] = useState<string | null>(null);
  const [autodraftEnabled, setAutodraftEnabled] = useState(false);

  const prevActiveRef = useRef<string | null>(null);
  const prevPickCountRef = useRef(0);
  const autoPickInFlightRef = useRef(false);
  const autodraftTurnRef = useRef<number | null>(null);

  const refreshDraft = useCallback(async () => {
    const data = await apiFetch<DraftPayload>(`/api/draft/${tournamentId}`);
    setDraft(data);
    setAutodraftEnabled(Boolean(data.autodraft_enabled));
    return data;
  }, [tournamentId]);

  const triggerAutoPick = useCallback(
    async (reason: "deadline" | "autodraft") => {
      if (autoPickInFlightRef.current) return;
      autoPickInFlightRef.current = true;
      try {
        const result = await apiFetch<AutoPickResult>("/api/draft/auto-pick", {
          method: "POST",
          body: JSON.stringify({ tournamentId, reason }),
        });
        if (result.ok && result.auto_picked && result.player_name) {
          const source = result.from_queue ? "from queue" : "best FedEx available";
          setAutoPickMessage(`Auto-picked ${result.player_name} (${source}).`);
          window.setTimeout(() => setAutoPickMessage(null), 4000);
        }
        await refreshDraft();
      } catch {
        // Next poll or timer tick will retry.
      } finally {
        autoPickInFlightRef.current = false;
      }
    },
    [refreshDraft, tournamentId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [user, data] = await Promise.all([
          apiFetch<AuthUser>("/api/me"),
          apiFetch<DraftPayload>(`/api/draft/${tournamentId}`),
        ]);
        if (cancelled) return;
        setMe(user);
        setDraft(data);
        setAutodraftEnabled(Boolean(data.autodraft_enabled));
        prevActiveRef.current = data.active_user_id;
        prevPickCountRef.current = data.rosters.length;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const draftStatus = draft?.draft_session.draft_status ?? null;
  const pickDeadline =
    draft?.pick_deadline_at ?? draft?.draft_session.pick_deadline_at ?? null;

  useEffect(() => {
    if (draftStatus !== "LIVE" || !pickDeadline) {
      setClockLabel(null);
      return;
    }

    const update = () => {
      setClockLabel(formatCountdown(pickDeadline));
      if (isDeadlineExpired(pickDeadline)) {
        void triggerAutoPick("deadline");
      }
    };

    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [draftStatus, pickDeadline, triggerAutoPick]);

  const isMyTurn =
    !!draft &&
    !!me &&
    draft.draft_session.draft_status === "LIVE" &&
    draft.active_user_id === me.id;

  useEffect(() => {
    if (!isMyTurn || !autodraftEnabled || !draft) return;
    const currentPick = draft.draft_session.current_pick;
    if (autodraftTurnRef.current === currentPick) return;
    autodraftTurnRef.current = currentPick;
    void triggerAutoPick("autodraft");
  }, [autodraftEnabled, draft, isMyTurn, triggerAutoPick]);

  // Poll while the draft room is open so other seats see picks / turn changes.
  useEffect(() => {
    if (!draftStatus || draftStatus === "FINISHED") return;

    const intervalMs = draftStatus === "LIVE" ? LIVE_POLL_MS : PENDING_POLL_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const schedule = () => {
      if (stopped) return;
      timer = setTimeout(() => {
        void tick();
      }, intervalMs);
    };

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      try {
        const data = await refreshDraft();
        const myId = me?.id;
        if (!myId) return;
        const pickCount = data.rosters.length;

        if (pickCount > prevPickCountRef.current) {
          setError(null);
        }
        prevPickCountRef.current = pickCount;

        const deadline =
          data.pick_deadline_at ?? data.draft_session.pick_deadline_at ?? null;
        if (
          data.draft_session.draft_status === "LIVE" &&
          isDeadlineExpired(deadline)
        ) {
          void triggerAutoPick("deadline");
        }

        if (
          data.draft_session.draft_status === "LIVE" &&
          data.active_user_id === myId &&
          prevActiveRef.current !== myId
        ) {
          setTurnFlash(true);
          window.setTimeout(() => setTurnFlash(false), 2500);
        }
        prevActiveRef.current = data.active_user_id;
      } catch {
        // Keep last good board; next tick retries.
      }
      schedule();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    schedule();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [draftStatus, me?.id, refreshDraft, triggerAutoPick]);

  const queuedIds = useMemo(
    () => new Set((draft?.my_queue ?? []).map((q) => q.player_id)),
    [draft?.my_queue],
  );

  const filteredPlayers = useMemo(() => {
    const players = draft?.available_players ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [draft?.available_players, query]);

  async function startDraft() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/draft/${tournamentId}/start`, { method: "POST" });
      await refreshDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAutodraft() {
    const next = !autodraftEnabled;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/draft/autodraft", {
        method: "POST",
        body: JSON.stringify({ tournamentId, enabled: next }),
      });
      setAutodraftEnabled(next);
      if (next) autodraftTurnRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update autodraft");
    } finally {
      setBusy(false);
    }
  }

  async function queuePlayer(playerId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/draft/queue", {
        method: "POST",
        body: JSON.stringify({ tournamentId, playerId }),
      });
      await refreshDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue player");
    } finally {
      setBusy(false);
    }
  }

  async function unqueuePlayer(playerId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/draft/queue", {
        method: "DELETE",
        body: JSON.stringify({ tournamentId, playerId }),
      });
      await refreshDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove from queue");
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
      setQuery("");
      await refreshDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pick failed");
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return <p className="text-[var(--muted)]">{error ?? "Loading draft…"}</p>;
  }

  const { tournament, draft_session, draft_order, rosters, active_user_id } = draft;
  const activeName =
    draft_order.find((d) => d.user_id === active_user_id)?.user_name ?? active_user_id;
  const showField =
    draft_session.draft_status === "PENDING" || draft_session.draft_status === "LIVE";
  const liveUpdating = draft_session.draft_status !== "FINISHED";
  const canQueue = draft_session.draft_status === "LIVE";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Snake draft</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
            {tournament.name}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Status: {draft_session.draft_status} · Pick{" "}
            {Math.min(draft_session.current_pick, draft.total_picks)} / {draft.total_picks}
            {active_user_id ? ` · On the clock: ${activeName}` : null}
            {liveUpdating ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                Live
              </span>
            ) : null}
          </p>
          {draft_session.draft_status === "LIVE" && clockLabel ? (
            <div
              className={`mt-4 inline-flex items-center gap-3 border-2 px-5 py-3 ${
                clockLabel === "0:00"
                  ? "animate-pulse border-red-600 bg-red-50"
                  : "border-[var(--accent)] bg-[var(--accent-soft)]"
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Pick clock
              </span>
              <span
                className={`font-mono text-5xl font-bold leading-none tabular-nums ${
                  clockLabel === "0:00" ? "text-red-700" : "text-[var(--ink)]"
                }`}
              >
                {clockLabel}
              </span>
            </div>
          ) : null}
          {isMyTurn && !autodraftEnabled && (
            <p
              className={`mt-2 text-sm font-semibold text-[var(--accent)] ${
                turnFlash ? "animate-pulse" : ""
              }`}
            >
              You’re on the clock — pick a player below.
            </p>
          )}
          {isMyTurn && autodraftEnabled && (
            <p className="mt-2 text-sm font-semibold text-[var(--accent)]">
              Autodraft is on — picking from your queue or best FedEx.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canQueue && (
            <button
              type="button"
              disabled={busy}
              onClick={toggleAutodraft}
              aria-pressed={autodraftEnabled}
              className={`px-5 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                autodraftEnabled
                  ? "bg-[var(--accent)] text-white shadow-lg ring-2 ring-[var(--accent)] ring-offset-2"
                  : "border border-[var(--line)] bg-white hover:bg-[var(--accent-soft)]"
              }`}
            >
              {autodraftEnabled ? "✓ Autodraft ON" : "Autodraft OFF"}
            </button>
          )}
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
      {autoPickMessage && (
        <p className="text-sm font-medium text-[var(--accent)]">{autoPickMessage}</p>
      )}

      {(draft.my_queue?.length ?? 0) > 0 && (
        <p className="text-sm text-[var(--muted)]">
          Your queue:{" "}
          {(draft.my_queue ?? []).map((q, index) => (
            <span key={q.player_id}>
              {index > 0 ? " → " : ""}
              {q.name}
            </span>
          ))}
        </p>
      )}

      <section className="grid gap-3 md:grid-cols-4">
        {draft_order.map((slot) => (
          <div
            key={slot.user_id}
            className={`border px-3 py-3 transition-colors ${
              slot.user_id === active_user_id
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--line)] bg-[var(--panel)]/70"
            }`}
          >
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Slot {slot.pick_position}
              {slot.user_id === active_user_id ? " · On clock" : ""}
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

      {showField && (
        <section className="space-y-4 border border-[var(--line)] bg-[var(--panel)]/80 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">
                Available players
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {draft.available_players.length} undrafted
                {query.trim() ? ` · ${filteredPlayers.length} match filter` : null}
                {isMyTurn && !autodraftEnabled ? " · Your pick — draft from the list" : null}
                {canQueue ? " · Queue players while you wait" : null}
              </p>
            </div>
            <input
              className="min-w-[220px] flex-1 border border-[var(--line)] bg-white px-3 py-2 md:max-w-xs"
              placeholder="Filter by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {draft.available_players.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No players in the cached field. Ask an admin to re-create the tournament (or sync the
              field) so the PGA field is loaded into D1.
            </p>
          ) : filteredPlayers.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No players match “{query.trim()}”.</p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-[var(--line)] overflow-y-auto border border-[var(--line)] bg-white/60">
              {filteredPlayers.map((p) => {
                const queued = queuedIds.has(p.id);
                return (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
                      queued ? "bg-[var(--accent-soft)]/40" : ""
                    }`}
                  >
                    <span>
                      {queued ? (
                        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                          Queued
                        </span>
                      ) : null}
                      {p.fedex_rank != null ? (
                        <span className="mr-2 font-medium text-[var(--muted)]">#{p.fedex_rank}</span>
                      ) : null}
                      {p.name}
                      {p.status ? (
                        <span className="ml-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                          {p.status}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex shrink-0 gap-2">
                      {canQueue && (
                        queued ? (
                          <button
                            disabled={busy}
                            onClick={() => unqueuePlayer(p.id)}
                            className="border border-[var(--line)] px-3 py-1 text-sm hover:bg-[var(--accent-soft)] disabled:opacity-50"
                          >
                            Unqueue
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => queuePlayer(p.id)}
                            className="border border-[var(--line)] px-3 py-1 text-sm hover:bg-[var(--accent-soft)] disabled:opacity-50"
                          >
                            Queue
                          </button>
                        )
                      )}
                      {isMyTurn && !autodraftEnabled ? (
                        <button
                          disabled={busy}
                          onClick={() => makePick(p.id, p.name)}
                          className="bg-[var(--accent)] px-3 py-1 text-sm text-white disabled:opacity-50"
                        >
                          Draft
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
