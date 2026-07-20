import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { GolfPlayer } from "@/lib/db/types";
import { golfPlayerName } from "@/lib/db/types";
import { error, handleRouteError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const tournId = searchParams.get("tournId")?.trim();
    const year = searchParams.get("year")?.trim();

    if (q.length < 2) {
      return error("Query q must be at least 2 characters");
    }
    if (!tournId || !year) {
      return error("tournId and year are required");
    }

    const db = await getDb();
    const like = `%${q}%`;
    const { results } = await db
      .prepare(
        `SELECT p.id, p.first_name, p.last_name, p.status
         FROM golf_players p
         JOIN golf_tournament_field f ON f.player_id = p.id
         WHERE f.tournament_id = ?
           AND (p.first_name LIKE ? OR p.last_name LIKE ?
                OR (p.first_name || ' ' || p.last_name) LIKE ?)
         ORDER BY p.last_name ASC, p.first_name ASC
         LIMIT 25`,
      )
      .bind(tournId, like, like, like)
      .all<GolfPlayer>();

    return json({
      players: (results ?? []).map((p) => ({
        id: p.id,
        name: golfPlayerName(p),
        status: p.status,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
