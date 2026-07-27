import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { DraftOrder, DraftSession, Tournament } from "@/lib/db/types";
import {
  DEFAULT_PICK_CLOCK_SECONDS,
  advanceDraftPick,
  ensureLivePickDeadline,
  isDeadlinePassed,
  normalizePickClockSeconds,
  selectBestAvailablePlayer,
} from "@/lib/draft/pickAdvance";
import { getUserIdAtPick } from "@/lib/snake";
import { TOTAL_PICKS } from "@/lib/status";
import { error, handleRouteError, json, readJson } from "@/lib/http";

interface AutoPickBody {
  tournamentId: string;
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const body = await readJson<AutoPickBody>(request);

    if (!body.tournamentId) {
      return error("tournamentId is required");
    }

    const db = await getDb();

    const tournament = await db
      .prepare(
        `SELECT id, external_tournament_id, year, pick_clock_seconds
         FROM tournaments WHERE id = ?`,
      )
      .bind(body.tournamentId)
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
      .bind(body.tournamentId)
      .first<DraftSession>();

    if (!session) return error("Draft session not found", 404);
    if (session.draft_status !== "LIVE") {
      return json({ skipped: true, reason: "not_live" });
    }
    if (session.current_pick > TOTAL_PICKS) {
      return json({ skipped: true, reason: "complete" });
    }

    if (!session.pick_deadline_at) {
      const deadline = await ensureLivePickDeadline(body.tournamentId, pickClockSeconds);
      session = { ...session, pick_deadline_at: deadline };
    }

    if (!session.pick_deadline_at || !isDeadlinePassed(session.pick_deadline_at)) {
      return json({ skipped: true, reason: "deadline_not_passed" });
    }

    const { results: orderRows } = await db
      .prepare(
        `SELECT tournament_id, user_id, pick_position
         FROM draft_order
         WHERE tournament_id = ?
         ORDER BY pick_position ASC`,
      )
      .bind(body.tournamentId)
      .all<DraftOrder>();

    const order = (orderRows ?? []).map((r) => r.user_id);
    const activeUserId = getUserIdAtPick(session.current_pick, order);
    if (!activeUserId) {
      return error("Could not resolve active seat", 500);
    }

    const best = await selectBestAvailablePlayer(
      body.tournamentId,
      tournament.external_tournament_id,
      tournament.year,
    );
    if (!best) {
      return error("No available players to auto-pick", 409);
    }

    try {
      const result = await advanceDraftPick({
        tournamentId: body.tournamentId,
        userId: activeUserId,
        playerId: best.id,
        playerName: best.name,
        pickClockSeconds,
        autoPicked: true,
      });
      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "Player already drafted" || message.includes("Draft is not live")) {
        const latest = await db
          .prepare(
            `SELECT tournament_id, current_pick, draft_status, pick_deadline_at
             FROM draft_sessions WHERE tournament_id = ?`,
          )
          .bind(body.tournamentId)
          .first<DraftSession>();
        return json({
          skipped: true,
          reason: "concurrent_pick",
          draft_session: latest,
        });
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
