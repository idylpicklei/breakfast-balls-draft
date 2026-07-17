import type { DraftStatus, TournamentStatus } from "@/lib/status";

export interface User {
  id: string;
  name: string;
  is_admin: number | boolean;
}

export interface Tournament {
  id: string;
  bdl_tournament_id: number;
  name: string;
  status: TournamentStatus;
  custom_prize_rule: string;
  created_at: string;
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
  bdl_player_id: number;
  player_name: string;
  pick_number: number;
}

export interface AuthUser {
  id: string;
  name: string;
  is_admin: boolean;
}
