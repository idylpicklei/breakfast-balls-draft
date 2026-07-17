import { requireAuth } from "@/lib/auth";
import { fetchTournamentResults } from "@/lib/balldontlie";
import { getDb } from "@/lib/db/client";
import type { Roster, Tournament, User } from "@/lib/db/types";
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
        "SELECT id, bdl_tournament_id, name, status, custom_prize_rule, created_at FROM tournaments WHERE id = ?",
      )
      .bind(id)
      .first<Tournament>();

    if (!tournament) return error("Tournament not found", 404);

    const { results: rosters } = await db
      .prepare(
        `SELECT tournament_id, user_id, bdl_player_id, player_name, pick_number
         FROM rosters WHERE tournament_id = ?`,
      )
      .bind(id)
      .all<Roster>();

    const { results: users } = await db
      .prepare("SELECT id, name, is_admin FROM users")
      .all<User>();

    let results: Awaited<ReturnType<typeof fetchTournamentResults>> = [];
    let fetchError: string | null = null;
    try {
      results = await fetchTournamentResults(tournament.bdl_tournament_id);
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Failed to fetch standings";
    }

    const leaderboard = buildLeaderboard(
      rosters ?? [],
      users ?? [],
      results,
      tournament.custom_prize_rule,
      tournament.id,
    );

    return json({
      tournament,
      leaderboard,
      fetch_error: fetchError,
      results_count: results.length,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
