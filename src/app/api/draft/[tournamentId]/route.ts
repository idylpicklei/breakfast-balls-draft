import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { DraftOrder, DraftSession, Roster, Tournament } from "@/lib/db/types";
import { getUserIdAtPick } from "@/lib/snake";
import { TOTAL_PICKS } from "@/lib/status";
import { error, handleRouteError, json } from "@/lib/http";

type Params = { params: Promise<{ tournamentId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    await requireAuth(request);
    const { tournamentId } = await params;
    const db = await getDb();

    const tournament = await db
      .prepare(
        "SELECT id, bdl_tournament_id, name, status, custom_prize_rule, created_at FROM tournaments WHERE id = ?",
      )
      .bind(tournamentId)
      .first<Tournament>();

    if (!tournament) return error("Tournament not found", 404);

    const session = await db
      .prepare(
        "SELECT tournament_id, current_pick, draft_status FROM draft_sessions WHERE tournament_id = ?",
      )
      .bind(tournamentId)
      .first<DraftSession>();

    if (!session) return error("Draft session not found", 404);

    const { results: orderRows } = await db
      .prepare(
        `SELECT d.tournament_id, d.user_id, d.pick_position, u.name as user_name
         FROM draft_order d
         JOIN users u ON u.id = d.user_id
         WHERE d.tournament_id = ?
         ORDER BY d.pick_position ASC`,
      )
      .bind(tournamentId)
      .all<DraftOrder & { user_name: string }>();

    const order = (orderRows ?? []).map((r) => r.user_id);

    const { results: rosters } = await db
      .prepare(
        `SELECT tournament_id, user_id, bdl_player_id, player_name, pick_number
         FROM rosters WHERE tournament_id = ?
         ORDER BY pick_number ASC`,
      )
      .bind(tournamentId)
      .all<Roster>();

    const activeUserId =
      session.draft_status === "LIVE" && session.current_pick <= TOTAL_PICKS
        ? getUserIdAtPick(session.current_pick, order)
        : null;

    return json({
      tournament,
      draft_session: session,
      draft_order: orderRows ?? [],
      rosters: rosters ?? [],
      active_user_id: activeUserId,
      total_picks: TOTAL_PICKS,
      picks_remaining: Math.max(0, TOTAL_PICKS - (session.current_pick - 1)),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
