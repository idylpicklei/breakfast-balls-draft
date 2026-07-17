import { requireAdmin, requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { Tournament } from "@/lib/db/types";
import { getTournamentById } from "@/lib/balldontlie";
import { DRAFT_SLOTS } from "@/lib/status";
import { error, handleRouteError, json, readJson } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const db = await getDb();
    const { results } = await db
      .prepare(
        "SELECT id, bdl_tournament_id, name, status, custom_prize_rule, created_at FROM tournaments ORDER BY created_at DESC",
      )
      .all<Tournament>();
    return json({ tournaments: results ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

interface CreateBody {
  bdl_tournament_id: number;
  name: string;
  custom_prize_rule: string;
  draft_order?: string[];
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson<CreateBody>(request);

    if (!body.bdl_tournament_id || !body.name?.trim() || !body.custom_prize_rule?.trim()) {
      return error("bdl_tournament_id, name, and custom_prize_rule are required");
    }

    const draftOrder = body.draft_order?.length
      ? body.draft_order
      : ["player-1", "player-2", "player-3", "player-4"];

    if (draftOrder.length !== DRAFT_SLOTS) {
      return error(`draft_order must contain exactly ${DRAFT_SLOTS} user ids`);
    }

    // Soft-validate external tournament id
    try {
      await getTournamentById(body.bdl_tournament_id);
    } catch {
      // ignore — allow create without live API in local/dev
    }

    const id = crypto.randomUUID();
    const db = await getDb();

    const statements = [
      db
        .prepare(
          `INSERT INTO tournaments (id, bdl_tournament_id, name, status, custom_prize_rule)
           VALUES (?, ?, ?, 'SCHEDULED', ?)`,
        )
        .bind(id, body.bdl_tournament_id, body.name.trim(), body.custom_prize_rule.trim()),
      db
        .prepare(
          `INSERT INTO draft_sessions (tournament_id, current_pick, draft_status)
           VALUES (?, 1, 'PENDING')`,
        )
        .bind(id),
      ...draftOrder.map((userId, index) =>
        db
          .prepare(
            `INSERT INTO draft_order (tournament_id, user_id, pick_position)
             VALUES (?, ?, ?)`,
          )
          .bind(id, userId, index + 1),
      ),
    ];

    await db.batch(statements);

    const tournament = await db
      .prepare(
        "SELECT id, bdl_tournament_id, name, status, custom_prize_rule, created_at FROM tournaments WHERE id = ?",
      )
      .bind(id)
      .first<Tournament>();

    return json({ tournament }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
