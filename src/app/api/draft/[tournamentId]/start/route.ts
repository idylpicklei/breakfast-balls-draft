import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { DraftSession, Tournament } from "@/lib/db/types";
import { error, handleRouteError, json } from "@/lib/http";

type Params = { params: Promise<{ tournamentId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAdmin(request);
    const { tournamentId } = await params;
    const db = await getDb();

    const tournament = await db
      .prepare("SELECT id, status FROM tournaments WHERE id = ?")
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
    if (session.draft_status === "FINISHED") {
      return error("Draft already finished", 409);
    }

    await db.batch([
      db
        .prepare(
          "UPDATE draft_sessions SET draft_status = 'LIVE', current_pick = COALESCE(current_pick, 1) WHERE tournament_id = ?",
        )
        .bind(tournamentId),
      db
        .prepare("UPDATE tournaments SET status = 'DRAFTING' WHERE id = ?")
        .bind(tournamentId),
    ]);

    return json({ ok: true, draft_status: "LIVE", tournament_status: "DRAFTING" });
  } catch (err) {
    return handleRouteError(err);
  }
}
