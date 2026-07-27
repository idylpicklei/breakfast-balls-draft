export interface ScheduleItem {
  tournId: string;
  name?: string;
  date?: {
    start?: string;
    end?: string;
    weekNumber?: string | number;
  };
  status?: string;
}

export interface ScheduleResponse {
  schedule?: ScheduleItem[];
}

export interface TournamentPlayer {
  playerId?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
}

export interface TournamentResponse {
  tournId?: string;
  name?: string;
  year?: string;
  status?: string;
  players?: TournamentPlayer[];
}

export interface LeaderboardRow {
  playerId?: string;
  firstName?: string;
  lastName?: string;
  position?: string | number;
  total?: string | number;
  currentRoundScore?: string | number;
  currentHole?: string | number;
  thru?: string | number;
}

export interface LeaderboardResponse {
  tournId?: string;
  year?: string;
  roundStatus?: string;
  leaderboardRows?: LeaderboardRow[];
}

export interface StatsRow {
  playerId?: string;
  firstName?: string;
  lastName?: string;
  rank?: string | number | { $numberInt?: string | number };
  ranking?: string | number | { $numberInt?: string | number };
  position?: string | number | { $numberInt?: string | number };
  rankOrder?: string | number | { $numberInt?: string | number };
}

export interface StatsResponse {
  year?: string;
  statId?: string;
  statName?: string;
  name?: string;
  rankings?: StatsRow[];
  rows?: StatsRow[];
  stats?: StatsRow[];
  statsRows?: StatsRow[];
  statRows?: StatsRow[];
  leaderboard?: StatsRow[];
  players?: StatsRow[];
}

export interface NormalizedFedExRanking {
  playerId: string;
  rank: number;
}

export interface NormalizedLeaderboardRow {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  total: number | null;
  parRelativeScore: number | null;
  /** Missed cut / WD / DQ — excluded from fantasy totals */
  missedCut: boolean;
  currentRoundScore: string | null;
  currentHole: string | null;
  thru: string | null;
}
