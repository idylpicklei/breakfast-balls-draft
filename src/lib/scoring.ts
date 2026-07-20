import type { Roster, User } from "@/lib/db/types";
import type { NormalizedLeaderboardRow } from "@/lib/golf/types";

export interface ScoredRosterPlayer extends Roster {
  par_relative_score: number | null;
  total_score: number | null;
  position: string | null;
  missed_cut: boolean;
  current_round_score: string | null;
  current_hole: string | null;
  thru: string | null;
}

export interface TeamStanding {
  user_id: string;
  user_name: string;
  /** Numeric total when 4 made-cut players exist; null means MC or incomplete */
  best_four_total: number | null;
  /** True when the side lacks 4 made-cut players (display as MC) */
  missed_cut: boolean;
  players: ScoredRosterPlayer[];
  counted_player_ids: string[];
}

export interface PartnershipStanding {
  team_id: string;
  team_name: string;
  sort_order: number;
  member_ids: string[];
  member_names: string[];
  best_four_total: number | null;
  missed_cut: boolean;
  players: ScoredRosterPlayer[];
  counted_player_ids: string[];
}

export interface BestSinglePlayer {
  player_id: string;
  player_name: string;
  user_id: string;
  user_name: string;
  par_relative_score: number;
}

export interface LeaderboardPayload {
  tournament_id: string;
  round_status: string | null;
  teams: TeamStanding[];
  partnerships: PartnershipStanding[];
  best_single_player: BestSinglePlayer | null;
}

export interface PartnershipTeamWithMembers {
  id: string;
  name: string;
  sort_order: number;
  member_ids: string[];
}

function madeCutScorers(players: ScoredRosterPlayer[]): ScoredRosterPlayer[] {
  return [...players]
    .filter((p) => !p.missed_cut && p.par_relative_score != null)
    .sort((a, b) => (a.par_relative_score as number) - (b.par_relative_score as number));
}

function bestFourFromPool(players: ScoredRosterPlayer[]): {
  best_four_total: number | null;
  missed_cut: boolean;
  counted_player_ids: string[];
} {
  const ranked = madeCutScorers(players);
  if (ranked.length >= 4) {
    const top4 = ranked.slice(0, 4);
    return {
      best_four_total: top4.reduce(
        (sum, p) => sum + (p.par_relative_score as number),
        0,
      ),
      missed_cut: false,
      counted_player_ids: top4.map((p) => p.player_id),
    };
  }

  // Fewer than 4 made-cut scorers: MC once anyone on the side was cut/WD, else pending
  const cutApplied = players.some((p) => p.missed_cut);
  return {
    best_four_total: null,
    missed_cut: cutApplied,
    counted_player_ids: [],
  };
}

export function buildLeaderboard(
  rosters: Roster[],
  users: User[],
  rows: NormalizedLeaderboardRow[],
  tournamentId: string,
  roundStatus: string | null = null,
  partnershipTeams: PartnershipTeamWithMembers[] = [],
): LeaderboardPayload {
  const scoreByPlayer = new Map<string, NormalizedLeaderboardRow>();
  for (const row of rows) {
    scoreByPlayer.set(row.playerId, row);
  }

  const userName = new Map(users.map((u) => [u.id, u.name]));

  const scored: ScoredRosterPlayer[] = rosters.map((r) => {
    const hit = scoreByPlayer.get(r.player_id);
    return {
      ...r,
      par_relative_score: hit?.parRelativeScore ?? null,
      total_score: hit?.total ?? null,
      position: hit?.position ?? null,
      missed_cut: hit?.missedCut ?? false,
      current_round_score: hit?.currentRoundScore ?? null,
      current_hole: hit?.currentHole ?? null,
      thru: hit?.thru ?? null,
    };
  });

  const byUser = new Map<string, ScoredRosterPlayer[]>();
  for (const player of scored) {
    const list = byUser.get(player.user_id) ?? [];
    list.push(player);
    byUser.set(player.user_id, list);
  }

  const teams: TeamStanding[] = [...byUser.entries()].map(([userId, players]) => {
    const best = bestFourFromPool(players);
    return {
      user_id: userId,
      user_name: userName.get(userId) ?? userId,
      best_four_total: best.best_four_total,
      missed_cut: best.missed_cut,
      players: players.sort((a, b) => a.pick_number - b.pick_number),
      counted_player_ids: best.counted_player_ids,
    };
  });

  teams.sort((a, b) => {
    if (a.missed_cut && b.missed_cut) return 0;
    if (a.missed_cut) return 1;
    if (b.missed_cut) return -1;
    if (a.best_four_total == null && b.best_four_total == null) return 0;
    if (a.best_four_total == null) return 1;
    if (b.best_four_total == null) return -1;
    return a.best_four_total - b.best_four_total;
  });

  let bestSingle: BestSinglePlayer | null = null;
  for (const player of scored) {
    if (player.missed_cut || player.par_relative_score == null) continue;
    if (
      !bestSingle ||
      player.par_relative_score < bestSingle.par_relative_score
    ) {
      bestSingle = {
        player_id: player.player_id,
        player_name: player.player_name,
        user_id: player.user_id,
        user_name: userName.get(player.user_id) ?? player.user_id,
        par_relative_score: player.par_relative_score,
      };
    }
  }

  return {
    tournament_id: tournamentId,
    round_status: roundStatus,
    teams,
    partnerships: buildPartnershipStandings(scored, users, partnershipTeams),
    best_single_player: bestSingle,
  };
}

export function buildPartnershipStandings(
  scored: ScoredRosterPlayer[],
  users: User[],
  partnershipTeams: PartnershipTeamWithMembers[],
): PartnershipStanding[] {
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const standings: PartnershipStanding[] = partnershipTeams.map((team) => {
    const memberSet = new Set(team.member_ids);
    const pool = scored.filter((p) => memberSet.has(p.user_id));
    const best = bestFourFromPool(pool);

    return {
      team_id: team.id,
      team_name: team.name,
      sort_order: team.sort_order,
      member_ids: team.member_ids,
      member_names: team.member_ids.map((id) => userName.get(id) ?? id),
      best_four_total: best.best_four_total,
      missed_cut: best.missed_cut,
      players: pool.sort((a, b) => a.pick_number - b.pick_number),
      counted_player_ids: best.counted_player_ids,
    };
  });

  standings.sort((a, b) => {
    if (a.missed_cut && b.missed_cut) return a.sort_order - b.sort_order;
    if (a.missed_cut) return 1;
    if (b.missed_cut) return -1;
    if (a.best_four_total == null && b.best_four_total == null) {
      return a.sort_order - b.sort_order;
    }
    if (a.best_four_total == null) return 1;
    if (b.best_four_total == null) return -1;
    if (a.best_four_total !== b.best_four_total) {
      return a.best_four_total - b.best_four_total;
    }
    return a.sort_order - b.sort_order;
  });

  return standings;
}
