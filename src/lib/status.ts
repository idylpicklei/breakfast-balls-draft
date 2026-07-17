export type TournamentStatus =
  | "SCHEDULED"
  | "DRAFTING"
  | "ACTIVE"
  | "COMPLETED";

export type DraftStatus = "PENDING" | "LIVE" | "FINISHED";

export const TOTAL_PICKS = 24;
export const PLAYERS_PER_TEAM = 6;
export const DRAFT_SLOTS = 4;
