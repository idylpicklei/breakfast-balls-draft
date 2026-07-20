"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { AuthUser, Tournament } from "@/lib/db/types";
import type { LeaderboardPayload } from "@/lib/scoring";
import type { NormalizedLeaderboardRow } from "@/lib/golf/types";

interface PgaBoardRow extends NormalizedLeaderboardRow {
  owner: { user_id: string; user_name: string } | null;
}

interface LeaderboardResponse {
  tournament: Tournament;
  leaderboard: LeaderboardPayload;
  pga_board: PgaBoardRow[];
  last_updated: string | null;
  cache_empty: boolean;
  results_count: number;
}

const USER_COLORS: Record<string, string> = {
  "player-1": "bg-sky-100 border-sky-300",
  "player-2": "bg-emerald-100 border-emerald-300",
  "player-3": "bg-amber-100 border-amber-300",
  "player-4": "bg-rose-100 border-rose-300",
  admin: "bg-violet-100 border-violet-300",
};

function formatScore(score: number | null | undefined) {
  if (score == null) return "—";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : String(score);
}

function formatUpdated(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export default function ScoreboardPage() {
  const params = useParams<{ id: string }>();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const payload = await apiFetch<LeaderboardResponse>(
      `/api/tournaments/${params.id}/leaderboard`,
    );
    setData(payload);
  }, [params.id]);

  useEffect(() => {
    apiFetch<AuthUser>("/api/me")
      .then(setMe)
      .catch(() => undefined);
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const ownerColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.pga_board ?? []) {
      if (row.owner) {
        map.set(
          row.owner.user_id,
          USER_COLORS[row.owner.user_id] ?? "bg-[var(--accent-soft)] border-[var(--line)]",
        );
      }
    }
    return map;
  }, [data?.pga_board]);

  async function refreshScores() {
    setRefreshing(true);
    setError(null);
    try {
      await apiFetch("/api/golf/sync-leaderboard", {
        method: "POST",
        body: JSON.stringify({ tournamentId: params.id }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  if (!data) {
    return <p className="text-[var(--muted)]">{error ?? "Loading scoreboard…"}</p>;
  }

  const { tournament, leaderboard, pga_board, last_updated, cache_empty } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Scoreboard</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
            {tournament.name}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            {tournament.status} · Last updated {formatUpdated(last_updated)}
            {cache_empty ? " · Admin must refresh scores" : null}
          </p>
        </div>
        <div className="flex gap-2">
          {me?.is_admin && (
            <button
              type="button"
              onClick={refreshScores}
              disabled={refreshing}
              className="bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh scores"}
            </button>
          )}
          <Link
            href={`/tournaments/${params.id}/draft`}
            className="border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--accent-soft)]"
          >
            Draft board
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {cache_empty && (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No cached scores yet. Admin: click <strong>Refresh scores</strong> once per day (1 API call).
        </p>
      )}

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Team standings</h2>
          <p className="text-sm text-[var(--muted)]">
            Best 4 of 6 from cached scores. Each player shows daily total.
          </p>
          <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]/80">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--surface)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Team</th>
                  <th className="px-3 py-2 font-semibold">Best 4</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.teams.map((team, index) => (
                  <tr key={team.user_id} className="border-b border-[var(--line)]/70">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{team.user_name}</p>
                      <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
                        {team.players.map((p) => (
                          <li key={p.player_id}>
                            {p.player_name}: {formatScore(p.par_relative_score)}
                            {p.thru ? ` · thru ${p.thru}` : ""}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {formatScore(team.best_four_total)}
                    </td>
                  </tr>
                ))}
                {leaderboard.teams.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-[var(--muted)]">
                      No rosters yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Best single player</h2>
            <div className="border border-[var(--line)] bg-[var(--panel)]/80 px-4 py-4">
              {leaderboard.best_single_player ? (
                <>
                  <p className="font-[family-name:var(--font-display)] text-3xl">
                    {leaderboard.best_single_player.player_name}
                  </p>
                  <p className="mt-1 text-[var(--muted)]">
                    {formatScore(leaderboard.best_single_player.par_relative_score)} · drafted by{" "}
                    {leaderboard.best_single_player.user_name}
                  </p>
                </>
              ) : (
                <p className="text-[var(--muted)]">No scored players yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">PGA leaderboard</h2>
        <p className="text-sm text-[var(--muted)]">
          Cached tournament field. Highlighted rows are drafted players — color matches owner.
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          {[...ownerColors.entries()].map(([userId, cls]) => {
            const name =
              pga_board.find((r) => r.owner?.user_id === userId)?.owner?.user_name ?? userId;
            return (
              <span key={userId} className={`border px-2 py-1 ${cls}`}>
                {name}
              </span>
            );
          })}
        </div>
        <div className="max-h-[480px] overflow-auto border border-[var(--line)] bg-[var(--panel)]/80">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-[var(--line)] bg-[var(--surface)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Pos</th>
                <th className="px-3 py-2 font-semibold">Player</th>
                <th className="px-3 py-2 font-semibold">Total</th>
                <th className="px-3 py-2 font-semibold">Round</th>
                <th className="px-3 py-2 font-semibold">Thru</th>
                <th className="px-3 py-2 font-semibold">Owner</th>
              </tr>
            </thead>
            <tbody>
              {pga_board.map((row) => {
                const colorClass = row.owner
                  ? ownerColors.get(row.owner.user_id)
                  : undefined;
                return (
                  <tr
                    key={row.playerId}
                    className={`border-b border-[var(--line)]/50 ${
                      colorClass ? `border-l-4 ${colorClass}` : ""
                    }`}
                  >
                    <td className="px-3 py-2">{row.position ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="px-3 py-2 font-medium">{formatScore(row.total)}</td>
                    <td className="px-3 py-2">{row.currentRoundScore ?? "—"}</td>
                    <td className="px-3 py-2">{row.thru ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {row.owner?.user_name ?? "—"}
                    </td>
                  </tr>
                );
              })}
              {pga_board.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-[var(--muted)]">
                    No cached leaderboard rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
