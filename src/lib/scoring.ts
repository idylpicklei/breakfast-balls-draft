import type { Roster, User } from "@/lib/db/types";
import type { BdlTournamentResult } from "@/lib/balldontlie";

export interface ScoredRosterPlayer extends Roster {
  par_relative_score: number | null;
  total_score: number | null;
  position: string | null;
}

export interface TeamStanding {
  user_id: string;
  user_name: string;
  best_four_total: number | null;
  players: ScoredRosterPlayer[];
  counted_player_ids: number[];
}

export interface BestSinglePlayer {
  bdl_player_id: number;
  player_name: string;
  user_id: string;
  user_name: string;
  par_relative_score: number;
}

export interface LeaderboardPayload {
  tournament_id: string;
  custom_prize_rule: string;
  teams: TeamStanding[];
  best_single_player: BestSinglePlayer | null;
}

export function buildLeaderboard(
  rosters: Roster[],
  users: User[],
  results: BdlTournamentResult[],
  customPrizeRule: string,
  tournamentId: string,
): LeaderboardPayload {
  const scoreByPlayer = new Map<number, BdlTournamentResult>();
  for (const result of results) {
    if (result.player?.id != null) {
      scoreByPlayer.set(result.player.id, result);
    }
  }

  const userName = new Map(users.map((u) => [u.id, u.name]));

  const scored: ScoredRosterPlayer[] = rosters.map((r) => {
    const hit = scoreByPlayer.get(r.bdl_player_id);
    return {
      ...r,
      par_relative_score: hit?.par_relative_score ?? null,
      total_score: hit?.total_score ?? null,
      position: hit?.position ?? null,
    };
  });

  const byUser = new Map<string, ScoredRosterPlayer[]>();
  for (const player of scored) {
    const list = byUser.get(player.user_id) ?? [];
    list.push(player);
    byUser.set(player.user_id, list);
  }

  const teams: TeamStanding[] = [...byUser.entries()].map(([userId, players]) => {
    const ranked = [...players]
      .filter((p) => p.par_relative_score != null)
      .sort((a, b) => (a.par_relative_score as number) - (b.par_relative_score as number));

    const top4 = ranked.slice(0, 4);
    const bestFourTotal =
      top4.length === 4
        ? top4.reduce((sum, p) => sum + (p.par_relative_score as number), 0)
        : null;

    return {
      user_id: userId,
      user_name: userName.get(userId) ?? userId,
      best_four_total: bestFourTotal,
      players: players.sort((a, b) => a.pick_number - b.pick_number),
      counted_player_ids: top4.map((p) => p.bdl_player_id),
    };
  });

  teams.sort((a, b) => {
    if (a.best_four_total == null && b.best_four_total == null) return 0;
    if (a.best_four_total == null) return 1;
    if (b.best_four_total == null) return -1;
    return a.best_four_total - b.best_four_total;
  });

  let bestSingle: BestSinglePlayer | null = null;
  for (const player of scored) {
    if (player.par_relative_score == null) continue;
    if (
      !bestSingle ||
      player.par_relative_score < bestSingle.par_relative_score
    ) {
      bestSingle = {
        bdl_player_id: player.bdl_player_id,
        player_name: player.player_name,
        user_id: player.user_id,
        user_name: userName.get(player.user_id) ?? player.user_id,
        par_relative_score: player.par_relative_score,
      };
    }
  }

  return {
    tournament_id: tournamentId,
    custom_prize_rule: customPrizeRule,
    teams,
    best_single_player: bestSingle,
  };
}
