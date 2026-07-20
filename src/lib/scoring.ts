import type { Roster, User } from "@/lib/db/types";
import type { NormalizedLeaderboardRow } from "@/lib/golf/types";

export interface ScoredRosterPlayer extends Roster {
  par_relative_score: number | null;
  total_score: number | null;
  position: string | null;
  current_round_score: string | null;
  current_hole: string | null;
  thru: string | null;
}

export interface TeamStanding {
  user_id: string;
  user_name: string;
  best_four_total: number | null;
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
  custom_prize_rule: string;
  round_status: string | null;
  teams: TeamStanding[];
  best_single_player: BestSinglePlayer | null;
}

export function buildLeaderboard(
  rosters: Roster[],
  users: User[],
  rows: NormalizedLeaderboardRow[],
  customPrizeRule: string,
  tournamentId: string,
  roundStatus: string | null = null,
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
      counted_player_ids: top4.map((p) => p.player_id),
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
    custom_prize_rule: customPrizeRule,
    round_status: roundStatus,
    teams,
    best_single_player: bestSingle,
  };
}
