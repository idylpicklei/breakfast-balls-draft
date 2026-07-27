import { requireAdmin, requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type {
  DraftOrder,
  DraftSession,
  Tournament,
  TournamentTeam,
  TournamentTeamMember,
  User,
} from "@/lib/db/types";
import { error, handleRouteError, json, readJson } from "@/lib/http";
import {
  resolvePartnershipTeams,
  validatePartnershipTeams,
  type PartnershipTeamInput,
} from "@/lib/teams";

type Params = { params: Promise<{ id: string }> };

async function loadPartnershipTeams(tournamentId: string) {
  const db = await getDb();
  const { results: teamRows } = await db
    .prepare(
      `SELECT id, tournament_id, name, sort_order
       FROM tournament_teams WHERE tournament_id = ?
       ORDER BY sort_order ASC`,
    )
    .bind(tournamentId)
    .all<TournamentTeam>();

  const { results: memberRows } = await db
    .prepare(
      `SELECT m.team_id, m.user_id
       FROM tournament_team_members m
       INNER JOIN tournament_teams t ON t.id = m.team_id
       WHERE t.tournament_id = ?`,
    )
    .bind(tournamentId)
    .all<TournamentTeamMember>();

  const membersByTeam = new Map<string, string[]>();
  for (const member of memberRows ?? []) {
    const list = membersByTeam.get(member.team_id) ?? [];
    list.push(member.user_id);
    membersByTeam.set(member.team_id, list);
  }

  return (teamRows ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    sort_order: team.sort_order,
    member_ids: membersByTeam.get(team.id) ?? [],
  }));
}

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

    const session = await db
      .prepare(
        "SELECT tournament_id, current_pick, draft_status FROM draft_sessions WHERE tournament_id = ?",
      )
      .bind(id)
      .first<DraftSession>();

    const { results: order } = await db
      .prepare(
        `SELECT d.tournament_id, d.user_id, d.pick_position, u.name as user_name
         FROM draft_order d
         JOIN users u ON u.id = d.user_id
         WHERE d.tournament_id = ?
         ORDER BY d.pick_position ASC`,
      )
      .bind(id)
      .all<DraftOrder & { user_name: string }>();

    const { results: users } = await db
      .prepare("SELECT id, name, is_admin FROM users")
      .all<User>();

    const partnershipTeams = await loadPartnershipTeams(id);

    return json({
      tournament,
      draft_session: session,
      draft_order: order ?? [],
      partnership_teams: partnershipTeams,
      users: users ?? [],
      editable: session?.draft_status === "PENDING",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

interface PatchBody {
  name?: string;
  draft_order?: string[];
  partnership_teams?: PartnershipTeamInput[];
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await readJson<PatchBody>(request);
    const db = await getDb();

    const tournament = await db
      .prepare(
        `SELECT id, external_tournament_id, year, name, status, created_at
         FROM tournaments WHERE id = ?`,
      )
      .bind(id)
      .first<Tournament>();

    if (!tournament) return error("Tournament not found", 404);

    const session = await db
      .prepare(
        "SELECT tournament_id, current_pick, draft_status FROM draft_sessions WHERE tournament_id = ?",
      )
      .bind(id)
      .first<DraftSession>();

    if (!session || session.draft_status !== "PENDING") {
      return error(
        "Tournament settings can only be edited while the draft is PENDING",
        409,
      );
    }

    const rosterCount = await db
      .prepare("SELECT COUNT(*) as n FROM rosters WHERE tournament_id = ?")
      .bind(id)
      .first<{ n: number }>();
    if ((rosterCount?.n ?? 0) > 0) {
      return error("Cannot edit settings after picks have been made", 409);
    }

    const nextName = body.name?.trim();
    if (body.name !== undefined && !nextName) {
      return error("name cannot be empty");
    }

    const draftOrder = body.draft_order;
    if (draftOrder !== undefined) {
      if (draftOrder.length !== 4) {
        return error("draft_order must contain exactly 4 user ids");
      }
    }

    if (body.partnership_teams !== undefined) {
      const teamValidation = validatePartnershipTeams(body.partnership_teams);
      if (teamValidation) return error(teamValidation);
    }

    const statements = [];

    if (nextName) {
      statements.push(
        db.prepare("UPDATE tournaments SET name = ? WHERE id = ?").bind(nextName, id),
      );
    }

    if (draftOrder) {
      statements.push(
        db.prepare("DELETE FROM draft_order WHERE tournament_id = ?").bind(id),
      );
      for (let i = 0; i < draftOrder.length; i++) {
        statements.push(
          db
            .prepare(
              `INSERT INTO draft_order (tournament_id, user_id, pick_position)
               VALUES (?, ?, ?)`,
            )
            .bind(id, draftOrder[i], i + 1),
        );
      }
    }

    if (body.partnership_teams !== undefined) {
      const partnershipTeams = resolvePartnershipTeams(body.partnership_teams);
      const existingTeams = await loadPartnershipTeams(id);
      for (const team of existingTeams) {
        statements.push(
          db.prepare("DELETE FROM tournament_team_members WHERE team_id = ?").bind(team.id),
        );
        statements.push(
          db.prepare("DELETE FROM tournament_teams WHERE id = ?").bind(team.id),
        );
      }
      for (let index = 0; index < partnershipTeams.length; index++) {
        const team = partnershipTeams[index];
        const teamId = crypto.randomUUID();
        statements.push(
          db
            .prepare(
              `INSERT INTO tournament_teams (id, tournament_id, name, sort_order)
               VALUES (?, ?, ?, ?)`,
            )
            .bind(teamId, id, team.name.trim(), index + 1),
        );
        for (const userId of team.member_ids) {
          statements.push(
            db
              .prepare(
                `INSERT INTO tournament_team_members (team_id, user_id)
                 VALUES (?, ?)`,
              )
              .bind(teamId, userId),
          );
        }
      }
    }

    if (statements.length === 0) {
      return error("No changes provided");
    }

    await db.batch(statements);

    const updated = await db
      .prepare(
        `SELECT id, external_tournament_id, year, name, status, created_at
         FROM tournaments WHERE id = ?`,
      )
      .bind(id)
      .first<Tournament>();

    const { results: order } = await db
      .prepare(
        `SELECT d.tournament_id, d.user_id, d.pick_position, u.name as user_name
         FROM draft_order d
         JOIN users u ON u.id = d.user_id
         WHERE d.tournament_id = ?
         ORDER BY d.pick_position ASC`,
      )
      .bind(id)
      .all<DraftOrder & { user_name: string }>();

    return json({
      tournament: updated,
      draft_session: session,
      draft_order: order ?? [],
      partnership_teams: await loadPartnershipTeams(id),
      editable: true,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
