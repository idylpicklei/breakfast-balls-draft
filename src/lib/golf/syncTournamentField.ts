import { getDb } from "@/lib/db/client";
import { PGA_ORG_ID, rapidFetch } from "@/lib/golf/client";
import type { TournamentResponse } from "@/lib/golf/types";

export interface SyncTournamentFieldResult {
  tournId: string;
  year: string;
  playersUpserted: number;
  fieldLinks: number;
}

export async function syncTournamentField(
  tournId: string,
  year: string,
): Promise<SyncTournamentFieldResult> {
  const data = await rapidFetch<TournamentResponse>("/tournament", {
    orgId: PGA_ORG_ID,
    tournId,
    year,
  });

  const players = data.players ?? [];
  const db = await getDb();
  const now = new Date().toISOString();

  // Ensure tournament row exists (may have been synced via schedule)
  await db
    .prepare(
      `INSERT INTO golf_tournaments (id, name, year, status, last_synced)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = COALESCE(excluded.name, golf_tournaments.name),
         year = excluded.year,
         status = COALESCE(excluded.status, golf_tournaments.status),
         last_synced = excluded.last_synced`,
    )
    .bind(tournId, data.name ?? `Tournament ${tournId}`, year, data.status ?? null, now)
    .run();

  const statements = [];
  for (const player of players) {
    const playerId = player.playerId;
    if (!playerId) continue;

    statements.push(
      db
        .prepare(
          `INSERT INTO golf_players (id, first_name, last_name, status)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             first_name = excluded.first_name,
             last_name = excluded.last_name,
             status = excluded.status`,
        )
        .bind(
          playerId,
          player.firstName ?? "",
          player.lastName ?? "",
          player.status ?? "active",
        ),
    );

    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO golf_tournament_field (tournament_id, player_id)
           VALUES (?, ?)`,
        )
        .bind(tournId, playerId),
    );
  }

  if (statements.length > 0) {
    await db.batch(statements);
  }

  const playerCount = players.filter((p) => p.playerId).length;
  console.log(
    `[syncTournamentField] Synced ${playerCount} players for ${tournId} (${year})`,
  );

  return {
    tournId,
    year,
    playersUpserted: playerCount,
    fieldLinks: playerCount,
  };
}
