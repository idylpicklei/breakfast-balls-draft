import type { LeaderboardRow, NormalizedLeaderboardRow } from "@/lib/golf/types";

export function parseScore(value: string | number | null | undefined): number | null {
  if (value == null || value === "" || value === "-") return null;
  if (typeof value === "number") return value;
  const trimmed = value.trim().toUpperCase();
  if (trimmed === "E") return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Positions that mean the player is out of the event (no fantasy total). */
export function isMissedCutPosition(position: string | null | undefined): boolean {
  if (position == null || position === "") return false;
  const p = String(position).trim().toUpperCase();
  return p === "CUT" || p === "MC" || p === "WD" || p === "DQ" || p === "DNS" || p === "MDF";
}

export function normalizeLeaderboardRow(row: LeaderboardRow): NormalizedLeaderboardRow | null {
  if (!row?.playerId) return null;
  const position = row.position != null ? String(row.position) : null;
  const missedCut = isMissedCutPosition(position);
  const total = parseScore(row.total);
  return {
    playerId: row.playerId,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    position,
    total,
    // Cut players keep raw total for reference but do not count in fantasy scoring
    parRelativeScore: missedCut ? null : total,
    missedCut,
    currentRoundScore:
      row.currentRoundScore != null ? String(row.currentRoundScore) : null,
    currentHole: row.currentHole != null ? String(row.currentHole) : null,
    thru: row.thru != null ? String(row.thru) : null,
  };
}
