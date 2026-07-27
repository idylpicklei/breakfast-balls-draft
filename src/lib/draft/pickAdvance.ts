import { getDb } from "@/lib/db/client";
import type { GolfPlayer } from "@/lib/db/types";
import { golfPlayerName } from "@/lib/db/types";
import { TOTAL_PICKS } from "@/lib/status";

export const MIN_PICK_CLOCK_SECONDS = 15;
export const MAX_PICK_CLOCK_SECONDS = 600;
export const DEFAULT_PICK_CLOCK_SECONDS = 60;

export function normalizePickClockSeconds(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_PICK_CLOCK_SECONDS;
  return Math.min(MAX_PICK_CLOCK_SECONDS, Math.max(MIN_PICK_CLOCK_SECONDS, Math.trunc(n)));
}

export function nextPickDeadlineIso(clockSeconds: number): string {
  return new Date(Date.now() + clockSeconds * 1000).toISOString();
}

export async function ensureLivePickDeadline(
  tournamentId: string,
  pickClockSeconds: number,
): Promise<string | null> {
  const db = await getDb();
  const session = await db
    .prepare(
      `SELECT draft_status, pick_deadline_at
       FROM draft_sessions WHERE tournament_id = ?`,
    )
    .bind(tournamentId)
    .first<{ draft_status: string; pick_deadline_at: string | null }>();

  if (!session || session.draft_status !== "LIVE") return null;
  if (session.pick_deadline_at) return session.pick_deadline_at;

  const deadline = nextPickDeadlineIso(pickClockSeconds);
  await db
    .prepare("UPDATE draft_sessions SET pick_deadline_at = ? WHERE tournament_id = ?")
    .bind(deadline, tournamentId);
  return deadline;
}

export function isDeadlinePassed(deadlineIso: string | null | undefined): boolean {
  if (!deadlineIso) return false;
  return Date.now() >= Date.parse(deadlineIso);
}

export interface PickAdvanceResult {
  ok: true;
  pick_number: number;
  next_pick: number | null;
  draft_status: "LIVE" | "FINISHED";
  tournament_status: "DRAFTING" | "ACTIVE";
  user_id: string;
  player_id: string;
  player_name: string;
  auto_picked: boolean;
}

export async function selectBestAvailablePlayer(
  tournamentId: string,
  externalTournamentId: string,
  year: string,
): Promise<{ id: string; name: string } | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT p.id, p.first_name, p.last_name
       FROM golf_players p
       JOIN golf_tournament_field f ON f.player_id = p.id
       LEFT JOIN golf_fedex_rankings r
         ON r.player_id = p.id AND r.year = ?
       WHERE f.tournament_id = ?
         AND p.id NOT IN (
           SELECT player_id FROM rosters WHERE tournament_id = ?
         )
       ORDER BY
         CASE WHEN r.rank IS NULL THEN 1 ELSE 0 END,
         r.rank ASC,
         p.last_name ASC,
         p.first_name ASC
       LIMIT 1`,
    )
    .bind(year, externalTournamentId, tournamentId)
    .first<GolfPlayer>();

  if (!row) return null;
  return { id: row.id, name: golfPlayerName(row) };
}

export async function advanceDraftPick(input: {
  tournamentId: string;
  userId: string;
  playerId: string;
  playerName: string;
  pickClockSeconds: number;
  autoPicked?: boolean;
}): Promise<PickAdvanceResult> {
  const db = await getDb();
  const session = await db
    .prepare(
      `SELECT tournament_id, current_pick, draft_status, pick_deadline_at
       FROM draft_sessions WHERE tournament_id = ?`,
    )
    .bind(input.tournamentId)
    .first<{
      tournament_id: string;
      current_pick: number;
      draft_status: string;
      pick_deadline_at: string | null;
    }>();

  if (!session) throw new Error("Draft session not found");
  if (session.draft_status !== "LIVE") throw new Error("Draft is not live");
  if (session.current_pick > TOTAL_PICKS) throw new Error("Draft is complete");

  const pickNumber = session.current_pick;
  const nextPick = pickNumber + 1;
  const finished = nextPick > TOTAL_PICKS;
  const nextDeadline = finished ? null : nextPickDeadlineIso(input.pickClockSeconds);

  try {
    const statements = [
      db
        .prepare(
          `INSERT INTO rosters (tournament_id, user_id, player_id, player_name, pick_number)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          input.tournamentId,
          input.userId,
          input.playerId.trim(),
          input.playerName.trim(),
          pickNumber,
        ),
      db
        .prepare(
          `UPDATE draft_sessions
           SET current_pick = ?, draft_status = ?, pick_deadline_at = ?
           WHERE tournament_id = ?`,
        )
        .bind(nextPick, finished ? "FINISHED" : "LIVE", nextDeadline, input.tournamentId),
    ];

    if (finished) {
      statements.push(
        db
          .prepare("UPDATE tournaments SET status = 'ACTIVE' WHERE id = ?")
          .bind(input.tournamentId),
      );
    }

    await db.batch(statements);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("unique")) {
      throw new Error("Player already drafted");
    }
    throw err;
  }

  return {
    ok: true,
    pick_number: pickNumber,
    next_pick: finished ? null : nextPick,
    draft_status: finished ? "FINISHED" : "LIVE",
    tournament_status: finished ? "ACTIVE" : "DRAFTING",
    user_id: input.userId,
    player_id: input.playerId.trim(),
    player_name: input.playerName.trim(),
    auto_picked: input.autoPicked ?? false,
  };
}
