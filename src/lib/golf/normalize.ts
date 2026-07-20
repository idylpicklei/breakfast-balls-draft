import type { LeaderboardRow, NormalizedLeaderboardRow } from "@/lib/golf/types";

export function parseScore(value: string | number | null | undefined): number | null {
  if (value == null || value === "" || value === "-") return null;
  if (typeof value === "number") return value;
  const trimmed = value.trim().toUpperCase();
  if (trimmed === "E") return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeLeaderboardRow(row: LeaderboardRow): NormalizedLeaderboardRow | null {
  if (!row?.playerId) return null;
  const total = parseScore(row.total);
  return {
    playerId: row.playerId,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    position: row.position != null ? String(row.position) : null,
    total,
    parRelativeScore: total,
    currentRoundScore:
      row.currentRoundScore != null ? String(row.currentRoundScore) : null,
    currentHole: row.currentHole != null ? String(row.currentHole) : null,
    thru: row.thru != null ? String(row.thru) : null,
  };
}
