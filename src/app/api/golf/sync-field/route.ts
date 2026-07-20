import { requireAdmin } from "@/lib/auth";
import { syncTournamentField } from "@/lib/golf/syncTournamentField";
import { error, handleRouteError, json, readJson } from "@/lib/http";

interface Body {
  tournId?: string;
  year?: string;
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson<Body>(request);
    if (!body.tournId?.trim()) {
      return error("tournId is required");
    }
    const year = body.year?.trim() || String(new Date().getFullYear());
    const result = await syncTournamentField(body.tournId.trim(), year);
    return json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
