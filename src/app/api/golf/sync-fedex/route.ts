import { requireAdmin } from "@/lib/auth";
import { syncFedExRankings } from "@/lib/golf/syncFedExRankings";
import { error, handleRouteError, json, readJson } from "@/lib/http";

interface Body {
  year?: string;
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson<Body>(request);
    const year = body.year?.trim() || String(new Date().getFullYear());
    const result = await syncFedExRankings(year);
    return json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
