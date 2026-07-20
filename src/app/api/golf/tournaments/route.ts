import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { GolfTournament } from "@/lib/db/types";
import { error, handleRouteError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year")?.trim() || String(new Date().getFullYear());

    const db = await getDb();
    const { results } = await db
      .prepare(
        `SELECT id, name, year, start_date, end_date, status, last_synced
         FROM golf_tournaments
         WHERE year = ?
         ORDER BY start_date ASC, name ASC`,
      )
      .bind(year)
      .all<GolfTournament>();

    return json({ year, tournaments: results ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}
