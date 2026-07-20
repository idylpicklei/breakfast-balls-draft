import { getDb } from "@/lib/db/client";
import { isMissedCutPosition } from "@/lib/golf/normalize";
import type { NormalizedLeaderboardRow } from "@/lib/golf/types";

export interface CachedLeaderboardResult {
  tournId: string;
  year: string;
  roundStatus: string | null;
  fetchedAt: string | null;
  rows: NormalizedLeaderboardRow[];
}

interface CachedRow {
  player_id: string;
  position: string | null;
  total: number | null;
  current_round_score: string | null;
  current_hole: string | null;
  thru: string | null;
  first_name: string | null;
  last_name: string | null;
}

export async function readCachedLeaderboard(
  tournId: string,
  year: string,
): Promise<CachedLeaderboardResult> {
  const db = await getDb();

  const meta = await db
    .prepare(
      `SELECT round_status, fetched_at FROM golf_leaderboard_meta
       WHERE tournament_id = ? AND year = ?`,
    )
    .bind(tournId, year)
    .first<{ round_status: string | null; fetched_at: string }>();

  const { results } = await db
    .prepare(
      `SELECT player_id, position, total, current_round_score, current_hole, thru,
              first_name, last_name
       FROM golf_leaderboard_rows
       WHERE tournament_id = ? AND year = ?
       ORDER BY
         CASE WHEN total IS NULL THEN 1 ELSE 0 END,
         total ASC,
         CASE WHEN position GLOB '[0-9]*' THEN CAST(position AS INTEGER) ELSE 999 END,
         last_name ASC, first_name ASC`,
    )
    .bind(tournId, year)
    .all<CachedRow>();

  const rows: NormalizedLeaderboardRow[] = (results ?? []).map((r) => {
    const missedCut = isMissedCutPosition(r.position);
    return {
      playerId: r.player_id,
      firstName: r.first_name ?? "",
      lastName: r.last_name ?? "",
      position: r.position,
      total: r.total,
      parRelativeScore: missedCut ? null : r.total,
      missedCut,
      currentRoundScore: r.current_round_score,
      currentHole: r.current_hole,
      thru: r.thru,
    };
  });

  return {
    tournId,
    year,
    roundStatus: meta?.round_status ?? null,
    fetchedAt: meta?.fetched_at ?? null,
    rows,
  };
}
