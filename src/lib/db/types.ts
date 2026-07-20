import type { DraftStatus, TournamentStatus } from "@/lib/status";

export interface User {
  id: string;
  name: string;
  username?: string | null;
  is_admin: number | boolean;
}

export interface Tournament {
  id: string;
  external_tournament_id: string;
  year: string;
  name: string;
  status: TournamentStatus;
  created_at: string;
}

export interface GolfTournament {
  id: string;
  name: string;
  year: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  last_synced: string;
}

export interface GolfPlayer {
  id: string;
  first_name: string;
  last_name: string;
  status: string | null;
}

export interface DraftSession {
  tournament_id: string;
  current_pick: number;
  draft_status: DraftStatus;
}

export interface DraftOrder {
  tournament_id: string;
  user_id: string;
  pick_position: number;
}

export interface Roster {
  tournament_id: string;
  user_id: string;
  player_id: string;
  player_name: string;
  pick_number: number;
}

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  name: string;
  sort_order: number;
}

export interface TournamentTeamMember {
  team_id: string;
  user_id: string;
}

export interface AuthUser {
  id: string;
  name: string;
  is_admin: boolean;
}

export function golfPlayerName(player: Pick<GolfPlayer, "first_name" | "last_name">): string {
  return [player.first_name, player.last_name].filter(Boolean).join(" ") || "Unknown";
}
