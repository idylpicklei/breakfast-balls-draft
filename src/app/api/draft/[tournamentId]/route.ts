import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { DraftOrder, DraftSession, GolfPlayer, Roster, Tournament } from "@/lib/db/types";
import { golfPlayerName } from "@/lib/db/types";
import {
  DEFAULT_PICK_CLOCK_SECONDS,
  ensureLivePickDeadline,
  normalizePickClockSeconds,
} from "@/lib/draft/pickAdvance";
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
        `SELECT id, external_tournament_id, year, name, status, pick_clock_seconds, created_at
         FROM tournaments WHERE id = ?`,
      )
      .bind(tournamentId)
      .first<Tournament>();

    if (!tournament) return error("Tournament not found", 404);

    const pickClockSeconds = normalizePickClockSeconds(
      tournament.pick_clock_seconds ?? DEFAULT_PICK_CLOCK_SECONDS,
    );

    let session = await db
      .prepare(
        `SELECT tournament_id, current_pick, draft_status, pick_deadline_at
         FROM draft_sessions WHERE tournament_id = ?`,
      )
      .bind(tournamentId)
      .first<DraftSession>();

    if (!session) return error("Draft session not found", 404);

    if (session.draft_status === "LIVE" && !session.pick_deadline_at) {
      const deadline = await ensureLivePickDeadline(tournamentId, pickClockSeconds);
      session = { ...session, pick_deadline_at: deadline };
    }

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
        `SELECT tournament_id, user_id, player_id, player_name, pick_number
         FROM rosters WHERE tournament_id = ?
         ORDER BY pick_number ASC`,
      )
      .bind(tournamentId)
      .all<Roster>();

    const { results: fieldPlayers } = await db
      .prepare(
        `SELECT p.id, p.first_name, p.last_name, p.status, r.rank AS fedex_rank
         FROM golf_players p
         JOIN golf_tournament_field f ON f.player_id = p.id
         LEFT JOIN golf_fedex_rankings r
           ON r.player_id = p.id AND r.year = ?
         WHERE f.tournament_id = ?
           AND p.id NOT IN (
             SELECT player_id FROM rosters WHERE tournament_id = ?
           )
         ORDER BY
           CASE WHEN r.rank IS NULL THEN 1 ELSE 0 END,
           r.rank ASC,
           p.last_name ASC,
           p.first_name ASC`,
      )
      .bind(tournament.year, tournament.external_tournament_id, tournamentId)
      .all<GolfPlayer & { fedex_rank: number | null }>();

    const activeUserId =
      session.draft_status === "LIVE" && session.current_pick <= TOTAL_PICKS
        ? getUserIdAtPick(session.current_pick, order)
        : null;

    return json({
      tournament: { ...tournament, pick_clock_seconds: pickClockSeconds },
      draft_session: session,
      draft_order: orderRows ?? [],
      rosters: rosters ?? [],
      available_players: (fieldPlayers ?? []).map((p) => ({
        id: p.id,
        name: golfPlayerName(p),
        status: p.status,
        fedex_rank: p.fedex_rank,
      })),
      active_user_id: activeUserId,
      total_picks: TOTAL_PICKS,
      picks_remaining: Math.max(0, TOTAL_PICKS - (session.current_pick - 1)),
      pick_clock_seconds: pickClockSeconds,
      pick_deadline_at: session.pick_deadline_at ?? null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
