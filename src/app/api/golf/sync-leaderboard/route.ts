import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { Tournament } from "@/lib/db/types";
import { syncLeaderboard } from "@/lib/golf/syncLeaderboard";
import { error, handleRouteError, json, readJson } from "@/lib/http";

interface Body {
  tournamentId?: string;
  tournId?: string;
  year?: string;
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson<Body>(request);
    const db = await getDb();

    let tournId = body.tournId?.trim();
    let year = body.year?.trim();

    if (body.tournamentId) {
      const fantasy = await db
        .prepare(
          `SELECT external_tournament_id, year FROM tournaments WHERE id = ?`,
        )
        .bind(body.tournamentId)
        .first<Pick<Tournament, "external_tournament_id" | "year">>();

      if (!fantasy) return error("Tournament not found", 404);
      tournId = fantasy.external_tournament_id;
      year = fantasy.year;
    }

    if (!tournId || !year) {
      return error("Provide tournamentId or both tournId and year");
    }

    const result = await syncLeaderboard(tournId, year);
    return json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
