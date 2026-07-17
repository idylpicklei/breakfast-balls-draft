import { getEnv } from "@/lib/db/client";

const BDL_BASE = "https://api.balldontlie.io";

export interface BdlPlayer {
  id: number;
  first_name?: string;
  last_name?: string;
  display_name?: string;
}

export interface BdlTournament {
  id: number;
  name?: string;
  status?: string;
}

export interface BdlTournamentResult {
  player: BdlPlayer;
  position?: string | null;
  position_numeric?: number | null;
  total_score?: number | null;
  par_relative_score?: number | null;
}

async function bdlFetch<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const env = await getEnv();
  const apiKey = env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    throw new Error("BALLDONTLIE_API_KEY is not configured");
  }

  const url = new URL(`${BDL_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
    },
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`balldontlie ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

export async function getTournamentById(
  id: number,
): Promise<BdlTournament | null> {
  try {
    const data = await bdlFetch<{ data: BdlTournament[] }>("/pga/v1/tournaments", {
      // some tiers expose v2; fall back gracefully
    });
    const match = data.data?.find((t) => t.id === id);
    return match ?? { id };
  } catch {
    try {
      const data = await bdlFetch<{ data: BdlTournament }>("/pga/v2/tournaments/" + id);
      return data.data ?? { id };
    } catch {
      return { id };
    }
  }
}

export async function fetchTournamentResults(
  tournamentId: number,
): Promise<BdlTournamentResult[]> {
  const results: BdlTournamentResult[] = [];
  let cursor: string | undefined;

  do {
    const page = await bdlFetch<{
      data: BdlTournamentResult[];
      meta?: { next_cursor?: number | string | null };
    }>("/pga/v1/tournament_results", {
      tournament_ids: tournamentId,
      per_page: 100,
      cursor,
    });

    results.push(...(page.data ?? []));
    const next = page.meta?.next_cursor;
    cursor = next === null || next === undefined ? undefined : String(next);
  } while (cursor);

  return results;
}

export async function searchPlayers(search: string): Promise<BdlPlayer[]> {
  const data = await bdlFetch<{ data: BdlPlayer[] }>("/pga/v1/players", {
    search,
    per_page: 25,
  });
  return data.data ?? [];
}

export function playerDisplayName(player: BdlPlayer): string {
  if (player.display_name) return player.display_name;
  return [player.first_name, player.last_name].filter(Boolean).join(" ") || `Player ${player.id}`;
}
