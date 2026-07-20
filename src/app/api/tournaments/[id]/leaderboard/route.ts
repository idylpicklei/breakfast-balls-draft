import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { Roster, Tournament, TournamentTeam, TournamentTeamMember, User } from "@/lib/db/types";
import { readCachedLeaderboard } from "@/lib/golf/readCachedLeaderboard";
import { buildLeaderboard } from "@/lib/scoring";
import { error, handleRouteError, json } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const db = await getDb();

    const tournament = await db
      .prepare(
        `SELECT id, external_tournament_id, year, name, status, created_at
         FROM tournaments WHERE id = ?`,
      )
      .bind(id)
      .first<Tournament>();

    if (!tournament) return error("Tournament not found", 404);

    const { results: rosters } = await db
      .prepare(
        `SELECT tournament_id, user_id, player_id, player_name, pick_number
         FROM rosters WHERE tournament_id = ?`,
      )
      .bind(id)
      .all<Roster>();

    const { results: users } = await db
      .prepare("SELECT id, name, is_admin FROM users")
      .all<User>();

    const { results: teamRows } = await db
      .prepare(
        `SELECT id, tournament_id, name, sort_order
         FROM tournament_teams WHERE tournament_id = ?
         ORDER BY sort_order ASC`,
      )
      .bind(id)
      .all<TournamentTeam>();

    const { results: memberRows } = await db
      .prepare(
        `SELECT m.team_id, m.user_id
         FROM tournament_team_members m
         INNER JOIN tournament_teams t ON t.id = m.team_id
         WHERE t.tournament_id = ?`,
      )
      .bind(id)
      .all<TournamentTeamMember>();

    const membersByTeam = new Map<string, string[]>();
    for (const member of memberRows ?? []) {
      const list = membersByTeam.get(member.team_id) ?? [];
      list.push(member.user_id);
      membersByTeam.set(member.team_id, list);
    }

    const partnershipTeams = (teamRows ?? []).map((team) => ({
      id: team.id,
      name: team.name,
      sort_order: team.sort_order,
      member_ids: membersByTeam.get(team.id) ?? [],
    }));

    const cached = await readCachedLeaderboard(
      tournament.external_tournament_id,
      tournament.year,
    );

    const leaderboard = buildLeaderboard(
      rosters ?? [],
      users ?? [],
      cached.rows,
      tournament.id,
      cached.roundStatus,
      partnershipTeams,
    );

    const ownerByPlayer = new Map<string, { user_id: string; user_name: string }>();
    for (const r of rosters ?? []) {
      const user = users?.find((u) => u.id === r.user_id);
      ownerByPlayer.set(r.player_id, {
        user_id: r.user_id,
        user_name: user?.name ?? r.user_id,
      });
    }

    const pgaBoard = cached.rows.map((row) => ({
      ...row,
      owner: ownerByPlayer.get(row.playerId) ?? null,
    }));

    return json({
      tournament,
      leaderboard,
      pga_board: pgaBoard,
      last_updated: cached.fetchedAt,
      cache_empty: cached.rows.length === 0,
      results_count: cached.rows.length,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
