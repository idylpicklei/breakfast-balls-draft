import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { Roster, Tournament, User } from "@/lib/db/types";
import { readCachedLeaderboard } from "@/lib/golf/readCachedLeaderboard";
import { buildLeaderboard } from "@/lib/scoring";
import { error, handleRouteError, json } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const db = await getDb();

    const tournament = await db
      .prepare(
        `SELECT id, external_tournament_id, year, name, status, custom_prize_rule, created_at
         FROM tournaments WHERE id = ?`,
      )
      .bind(id)
      .first<Tournament>();

    if (!tournament) return error("Tournament not found", 404);

    const { results: rosters } = await db
      .prepare(
        `SELECT tournament_id, user_id, player_id, player_name, pick_number
         FROM rosters WHERE tournament_id = ?`,
      )
      .bind(id)
      .all<Roster>();

    const { results: users } = await db
      .prepare("SELECT id, name, is_admin FROM users")
      .all<User>();

    const cached = await readCachedLeaderboard(
      tournament.external_tournament_id,
      tournament.year,
    );

    const leaderboard = buildLeaderboard(
      rosters ?? [],
      users ?? [],
      cached.rows,
      tournament.custom_prize_rule,
      tournament.id,
      cached.roundStatus,
    );

    const ownerByPlayer = new Map<string, { user_id: string; user_name: string }>();
    for (const r of rosters ?? []) {
      const user = users?.find((u) => u.id === r.user_id);
      ownerByPlayer.set(r.player_id, {
        user_id: r.user_id,
        user_name: user?.name ?? r.user_id,
      });
    }

    const pgaBoard = cached.rows.map((row) => ({
      ...row,
      owner: ownerByPlayer.get(row.playerId) ?? null,
    }));

    return json({
      tournament,
      leaderboard,
      pga_board: pgaBoard,
      last_updated: cached.fetchedAt,
      cache_empty: cached.rows.length === 0,
      results_count: cached.rows.length,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
