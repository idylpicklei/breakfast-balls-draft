import { getDb } from "@/lib/db/client";
import { PGA_ORG_ID, rapidFetch } from "@/lib/golf/client";
import { normalizeLeaderboardRow } from "@/lib/golf/normalize";
import type { LeaderboardResponse } from "@/lib/golf/types";

export interface SyncLeaderboardResult {
  tournId: string;
  year: string;
  roundStatus: string | null;
  rowsUpserted: number;
  fetchedAt: string;
}

export async function syncLeaderboard(
  tournId: string,
  year: string,
): Promise<SyncLeaderboardResult> {
  const db = await getDb();
  const cached = await db
    .prepare("SELECT id, year FROM golf_tournaments WHERE id = ?")
    .bind(tournId)
    .first<{ id: string; year: string }>();

  const resolvedYear = year || cached?.year;
  if (!resolvedYear) {
    throw new Error(`Tournament ${tournId} not found in cache — sync schedule first`);
  }

  const data = await rapidFetch<LeaderboardResponse>("/leaderboard", {
    orgId: PGA_ORG_ID,
    tournId,
    year: resolvedYear,
  });

  const fetchedAt = new Date().toISOString();
  const rows = (data.leaderboardRows ?? [])
    .map(normalizeLeaderboardRow)
    .filter((r) => r != null);

  await db
    .prepare(
      `DELETE FROM golf_leaderboard_rows WHERE tournament_id = ? AND year = ?`,
    )
    .bind(tournId, resolvedYear)
    .run();

  const statements = rows.map((row) =>
    db
      .prepare(
        `INSERT INTO golf_leaderboard_rows (
           tournament_id, year, player_id, position, total,
           current_round_score, current_hole, thru, first_name, last_name, fetched_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        tournId,
        resolvedYear,
        row.playerId,
        row.position,
        row.total,
        row.currentRoundScore,
        row.currentHole,
        row.thru,
        row.firstName,
        row.lastName,
        fetchedAt,
      ),
  );

  statements.push(
    db
      .prepare(
        `INSERT INTO golf_leaderboard_meta (tournament_id, year, round_status, fetched_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tournament_id, year) DO UPDATE SET
           round_status = excluded.round_status,
           fetched_at = excluded.fetched_at`,
      )
      .bind(tournId, resolvedYear, data.roundStatus ?? null, fetchedAt),
  );

  if (statements.length > 0) {
    await db.batch(statements);
  }

  console.log(
    `[syncLeaderboard] Cached ${rows.length} rows for ${tournId} (${resolvedYear})`,
  );

  return {
    tournId,
    year: resolvedYear,
    roundStatus: data.roundStatus ?? null,
    rowsUpserted: rows.length,
    fetchedAt,
  };
}
