import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { DraftOrder, DraftSession, Tournament, User } from "@/lib/db/types";
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

    const session = await db
      .prepare(
        "SELECT tournament_id, current_pick, draft_status FROM draft_sessions WHERE tournament_id = ?",
      )
      .bind(id)
      .first<DraftSession>();

    const { results: order } = await db
      .prepare(
        `SELECT d.tournament_id, d.user_id, d.pick_position, u.name as user_name
         FROM draft_order d
         JOIN users u ON u.id = d.user_id
         WHERE d.tournament_id = ?
         ORDER BY d.pick_position ASC`,
      )
      .bind(id)
      .all<DraftOrder & { user_name: string }>();

    const { results: users } = await db
      .prepare("SELECT id, name, is_admin FROM users")
      .all<User>();

    return json({
      tournament,
      draft_session: session,
      draft_order: order ?? [],
      users: users ?? [],
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
