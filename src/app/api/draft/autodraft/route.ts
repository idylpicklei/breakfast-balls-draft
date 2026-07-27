import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { error, handleRouteError, json, readJson } from "@/lib/http";

interface AutodraftBody {
  tournamentId: string;
  enabled: boolean;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await readJson<AutodraftBody>(request);

    if (!body.tournamentId || typeof body.enabled !== "boolean") {
      return error("tournamentId and enabled are required");
    }

    const db = await getDb();

    const session = await db
      .prepare("SELECT draft_status FROM draft_sessions WHERE tournament_id = ?")
      .bind(body.tournamentId)
      .first<{ draft_status: string }>();

    if (!session) return error("Draft session not found", 404);
    if (session.draft_status === "FINISHED") {
      return error("Draft is finished", 409);
    }

    await db
      .prepare(
        `INSERT INTO draft_user_settings (tournament_id, user_id, autodraft_enabled)
         VALUES (?, ?, ?)
         ON CONFLICT(tournament_id, user_id) DO UPDATE SET autodraft_enabled = excluded.autodraft_enabled`,
      )
      .bind(body.tournamentId, user.id, body.enabled ? 1 : 0)
      .run();

    return json({ ok: true, autodraft_enabled: body.enabled });
  } catch (err) {
    return handleRouteError(err);
  }
}
