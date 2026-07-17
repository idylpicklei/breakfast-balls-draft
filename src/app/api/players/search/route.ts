import { requireAuth } from "@/lib/auth";
import { playerDisplayName, searchPlayers } from "@/lib/balldontlie";
import { error, handleRouteError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return error("Query q must be at least 2 characters");
    }

    try {
      const players = await searchPlayers(q);
      return json({
        players: players.map((p) => ({
          id: p.id,
          name: playerDisplayName(p),
        })),
      });
    } catch (err) {
      return json({
        players: [],
        fetch_error: err instanceof Error ? err.message : "Player search failed",
      });
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
