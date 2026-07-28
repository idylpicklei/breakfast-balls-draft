import { getDb } from "@/lib/db/client";
import { rapidFetch } from "@/lib/golf/client";
import type { StatsResponse, StatsRow } from "@/lib/golf/types";

export const FEDEX_STAT_ID = "02671";
export const WORLD_RANKING_STAT_ID = "186";

/** Primary ranking used for draft sort / auto-pick (OWGR). */
export const DRAFT_RANKING_STAT_ID = WORLD_RANKING_STAT_ID;

export interface SyncFedExRankingsResult {
  year: string;
  rowsUpserted: number;
  syncedAt: string;
  statId: string;
}

function parseRank(value: StatsRow["rank"]): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "object" && "$numberInt" in value) {
    return parseRank(value.$numberInt);
  }
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const trimmed = String(value).trim();
  const digits = trimmed.replace(/^T/i, "").match(/^\d+/);
  if (!digits) return null;
  const parsed = Number(digits[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractStatsRows(data: StatsResponse): StatsRow[] {
  const candidates = [
    data.rankings,
    data.rows,
    data.stats,
    data.statsRows,
    data.statRows,
    data.leaderboard,
    data.players,
  ];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length > 0) return list;
  }
  return [];
}

export function normalizeFedExStatsRows(rows: StatsRow[]): { playerId: string; rank: number }[] {
  const out: { playerId: string; rank: number }[] = [];
  for (const row of rows) {
    const playerId = row.playerId?.trim();
    if (!playerId) continue;
    const rank =
      parseRank(row.rank) ??
      parseRank(row.ranking) ??
      parseRank(row.position) ??
      parseRank(row.rankOrder);
    if (rank == null) continue;
    out.push({ playerId, rank });
  }
  return out;
}

export async function syncFedExRankings(year: string): Promise<SyncFedExRankingsResult> {
  const data = await rapidFetch<StatsResponse>("/stats", {
    year,
    statId: DRAFT_RANKING_STAT_ID,
  });

  const normalized = normalizeFedExStatsRows(extractStatsRows(data));
  const db = await getDb();
  const syncedAt = new Date().toISOString();

  if (normalized.length === 0) {
    console.warn(
      `[syncFedExRankings] No rows parsed for ${year} statId=${DRAFT_RANKING_STAT_ID}`,
    );
    return { year, rowsUpserted: 0, syncedAt, statId: DRAFT_RANKING_STAT_ID };
  }

  const known = await db
    .prepare("SELECT id FROM golf_players")
    .all<{ id: string }>();
  const knownIds = new Set((known.results ?? []).map((r) => r.id));

  const ranked = normalized.filter((r) => knownIds.has(r.playerId));

  await db.prepare("DELETE FROM golf_fedex_rankings WHERE year = ?").bind(year).run();

  const statements = ranked.map((row) =>
    db
      .prepare(
        `INSERT INTO golf_fedex_rankings (year, player_id, rank, synced_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(year, row.playerId, row.rank, syncedAt),
  );

  if (statements.length > 0) {
    await db.batch(statements);
  }

  console.log(
    `[syncFedExRankings] Cached ${ranked.length} world ranks for ${year} (statId=${DRAFT_RANKING_STAT_ID}, ${normalized.length} from API)`,
  );

  return {
    year,
    rowsUpserted: ranked.length,
    syncedAt,
    statId: DRAFT_RANKING_STAT_ID,
  };
}
