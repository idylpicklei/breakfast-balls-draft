import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { DraftOrder, DraftSession } from "@/lib/db/types";
import { getUserIdAtPick } from "@/lib/snake";
import { TOTAL_PICKS } from "@/lib/status";
import { error, handleRouteError, json, readJson } from "@/lib/http";

interface PickBody {
  tournamentId: string;
  playerId: string;
  playerName: string;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await readJson<PickBody>(request);

    if (!body.tournamentId || !body.playerId?.trim() || !body.playerName?.trim()) {
      return error("tournamentId, playerId, and playerName are required");
    }

    const db = await getDb();

    const session = await db
      .prepare(
        "SELECT tournament_id, current_pick, draft_status FROM draft_sessions WHERE tournament_id = ?",
      )
      .bind(body.tournamentId)
      .first<DraftSession>();

    if (!session) return error("Draft session not found", 404);
    if (session.draft_status !== "LIVE") {
      return error("Draft is not live", 409);
    }
    if (session.current_pick > TOTAL_PICKS) {
      return error("Draft is complete", 409);
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

    if (activeUserId !== user.id) {
      return error("It is not your turn to pick", 403);
    }

    const pickNumber = session.current_pick;
    const nextPick = pickNumber + 1;
    const finished = nextPick > TOTAL_PICKS;

    try {
      const statements = [
        db
          .prepare(
            `INSERT INTO rosters (tournament_id, user_id, player_id, player_name, pick_number)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            body.tournamentId,
            user.id,
            body.playerId.trim(),
            body.playerName.trim(),
            pickNumber,
          ),
        db
          .prepare(
            `UPDATE draft_sessions
             SET current_pick = ?, draft_status = ?
             WHERE tournament_id = ?`,
          )
          .bind(nextPick, finished ? "FINISHED" : "LIVE", body.tournamentId),
      ];

      if (finished) {
        statements.push(
          db
            .prepare("UPDATE tournaments SET status = 'ACTIVE' WHERE id = ?")
            .bind(body.tournamentId),
        );
      }

      await db.batch(statements);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("unique")) {
        return error("Player already drafted", 409);
      }
      throw err;
    }

    return json({
      ok: true,
      pick_number: pickNumber,
      next_pick: finished ? null : nextPick,
      draft_status: finished ? "FINISHED" : "LIVE",
      tournament_status: finished ? "ACTIVE" : "DRAFTING",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
