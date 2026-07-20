import { requireAdmin, requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import type { GolfTournament, Tournament } from "@/lib/db/types";
import { syncTournamentField } from "@/lib/golf/syncTournamentField";
import { error, handleRouteError, json, readJson } from "@/lib/http";
import {
  resolvePartnershipTeams,
  validatePartnershipTeams,
  type PartnershipTeamInput,
} from "@/lib/teams";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const db = await getDb();
    const { results } = await db
      .prepare(
        `SELECT id, external_tournament_id, year, name, status, created_at
         FROM tournaments ORDER BY created_at DESC`,
      )
      .all<Tournament>();
    return json({ tournaments: results ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}

interface CreateBody {
  external_tournament_id: string;
  year: string;
  name: string;
  draft_order?: string[];
  partnership_teams?: PartnershipTeamInput[];
  sync_field?: boolean;
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson<CreateBody>(request);

    if (!body.external_tournament_id?.trim() || !body.year?.trim() || !body.name?.trim()) {
      return error("external_tournament_id, year, and name are required");
    }

    const draftOrder = body.draft_order?.length
      ? body.draft_order
      : ["MinJungKyu", "PaulHawk", "PigTank", "Dylpickle"];

    if (draftOrder.length !== 4) {
      return error("draft_order must contain exactly 4 user ids");
    }

    const teamValidation = validatePartnershipTeams(body.partnership_teams);
    if (teamValidation) return error(teamValidation);

    const partnershipTeams = resolvePartnershipTeams(body.partnership_teams);

    const tournId = body.external_tournament_id.trim();
    const year = body.year.trim();
    const db = await getDb();

    const cached = await db
      .prepare("SELECT id FROM golf_tournaments WHERE id = ? AND year = ?")
      .bind(tournId, year)
      .first<GolfTournament>();

    if (!cached) {
      return error(
        "Tournament not in cache — sync schedule first, then select a cached tournId",
        400,
      );
    }

    if (body.sync_field !== false) {
      const field = await syncTournamentField(tournId, year);
      if (field.playersUpserted === 0) {
        return error(
          "Field sync returned 0 players for this tournament — check RAPID_API and try again",
          502,
        );
      }
    }

    const id = crypto.randomUUID();

    const teamStatements = partnershipTeams.flatMap((team, index) => {
      const teamId = crypto.randomUUID();
      return [
        db
          .prepare(
            `INSERT INTO tournament_teams (id, tournament_id, name, sort_order)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(teamId, id, team.name.trim(), index + 1),
        ...team.member_ids.map((userId) =>
          db
            .prepare(
              `INSERT INTO tournament_team_members (team_id, user_id)
               VALUES (?, ?)`,
            )
            .bind(teamId, userId),
        ),
      ];
    });

    const statements = [
      db
        .prepare(
          `INSERT INTO tournaments (id, external_tournament_id, year, name, status)
           VALUES (?, ?, ?, ?, 'SCHEDULED')`,
        )
        .bind(id, tournId, year, body.name.trim()),
      db
        .prepare(
          `INSERT INTO draft_sessions (tournament_id, current_pick, draft_status)
           VALUES (?, 1, 'PENDING')`,
        )
        .bind(id),
      ...draftOrder.map((userId, index) =>
        db
          .prepare(
            `INSERT INTO draft_order (tournament_id, user_id, pick_position)
             VALUES (?, ?, ?)`,
          )
          .bind(id, userId, index + 1),
      ),
      ...teamStatements,
    ];

    await db.batch(statements);

    const tournament = await db
      .prepare(
        `SELECT id, external_tournament_id, year, name, status, created_at
         FROM tournaments WHERE id = ?`,
      )
      .bind(id)
      .first<Tournament>();

    return json({ tournament }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
