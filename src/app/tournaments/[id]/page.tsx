"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Tournament } from "@/lib/db/types";
import type { LeaderboardPayload } from "@/lib/scoring";

interface LeaderboardResponse {
  tournament: Tournament;
  leaderboard: LeaderboardPayload;
  fetch_error: string | null;
  results_count: number;
}

function formatScore(score: number | null | undefined) {
  if (score == null) return "—";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : String(score);
}

export default function ScoreboardPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const payload = await apiFetch<LeaderboardResponse>(
      `/api/tournaments/${params.id}/leaderboard`,
    );
    setData(payload);
  }, [params.id]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    const timer = setInterval(() => {
      load().catch(() => undefined);
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  if (!data) {
    return <p className="text-[var(--muted)]">{error ?? "Loading scoreboard…"}</p>;
  }

  const { tournament, leaderboard, fetch_error, results_count } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Live scoreboard</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
            {tournament.name}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            {tournament.status} · {results_count} PGA results loaded · refreshes every 30s
          </p>
        </div>
        <Link
          href={`/tournaments/${params.id}/draft`}
          className="border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--accent-soft)]"
        >
          Draft board
        </Link>
      </div>

      {fetch_error && (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Live scores unavailable: {fetch_error}. Set `BALLDONTLIE_API_KEY` for standings.
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Best 4 Total</h2>
          <p className="text-sm text-[var(--muted)]">
            Lowest combined par-relative score from each team&apos;s best 4 of 6.
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
                      <p className="text-xs text-[var(--muted)]">
                        {team.players
                          .map(
                            (p) =>
                              `${p.player_name} (${formatScore(p.par_relative_score)})`,
                          )
                          .join(" · ")}
                      </p>
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
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Best Single Player</h2>
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

          <div className="space-y-3">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Custom Prize</h2>
            <div className="border border-[var(--line)] bg-[var(--sand)]/40 px-4 py-4">
              <p className="text-sm uppercase tracking-wider text-[var(--muted)]">
                Admin rule (display only)
              </p>
              <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                {leaderboard.custom_prize_rule}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
