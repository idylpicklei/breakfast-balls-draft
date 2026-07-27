import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { error, handleRouteError, json, readJson } from "@/lib/http";

interface QueueBody {
  tournamentId: string;
  playerId: string;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await readJson<QueueBody>(request);

    if (!body.tournamentId || !body.playerId?.trim()) {
      return error("tournamentId and playerId are required");
    }

    const playerId = body.playerId.trim();
    const db = await getDb();

    const session = await db
      .prepare("SELECT draft_status FROM draft_sessions WHERE tournament_id = ?")
      .bind(body.tournamentId)
      .first<{ draft_status: string }>();

    if (!session) return error("Draft session not found", 404);
    if (session.draft_status !== "LIVE") {
      return error("Queue is only available while the draft is LIVE", 409);
    }

    const drafted = await db
      .prepare(
        "SELECT 1 FROM rosters WHERE tournament_id = ? AND player_id = ? LIMIT 1",
      )
      .bind(body.tournamentId, playerId)
      .first();

    if (drafted) {
      return error("Player already drafted", 409);
    }

    const existing = await db
      .prepare(
        `SELECT 1 FROM draft_queues
         WHERE tournament_id = ? AND user_id = ? AND player_id = ?`,
      )
      .bind(body.tournamentId, user.id, playerId)
      .first();

    if (existing) {
      return json({ ok: true, already_queued: true });
    }

    const maxOrder = await db
      .prepare(
        `SELECT MAX(sort_order) as max_order
         FROM draft_queues
         WHERE tournament_id = ? AND user_id = ?`,
      )
      .bind(body.tournamentId, user.id)
      .first<{ max_order: number | null }>();

    const sortOrder = (maxOrder?.max_order ?? 0) + 1;

    await db
      .prepare(
        `INSERT INTO draft_queues (tournament_id, user_id, player_id, sort_order)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(body.tournamentId, user.id, playerId, sortOrder)
      .run();

    return json({ ok: true, player_id: playerId, sort_order: sortOrder });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await readJson<QueueBody>(request);

    if (!body.tournamentId || !body.playerId?.trim()) {
      return error("tournamentId and playerId are required");
    }

    const db = await getDb();
    await db
      .prepare(
        `DELETE FROM draft_queues
         WHERE tournament_id = ? AND user_id = ? AND player_id = ?`,
      )
      .bind(body.tournamentId, user.id, body.playerId.trim())
      .run();

    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
