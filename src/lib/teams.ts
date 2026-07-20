export interface PartnershipTeamInput {
  name: string;
  member_ids: string[];
}

export const DEFAULT_PARTNERSHIP_TEAMS: PartnershipTeamInput[] = [
  { name: "Idaho", member_ids: ["Dylpickle", "MinJungKyu"] },
  { name: "Oregon", member_ids: ["PigTank", "PaulHawk"] },
];

const LEAGUE_USER_IDS = new Set([
  "Dylpickle",
  "MinJungKyu",
  "PaulHawk",
  "PigTank",
]);

export function validatePartnershipTeams(
  teams: PartnershipTeamInput[] | undefined,
): string | null {
  const input = teams?.length ? teams : DEFAULT_PARTNERSHIP_TEAMS;

  if (input.length !== 2) {
    return "partnership_teams must contain exactly 2 teams";
  }

  const seenUsers = new Set<string>();
  for (const team of input) {
    if (!team.name?.trim()) {
      return "Each team must have a name";
    }
    if (team.member_ids.length !== 2) {
      return `Team "${team.name}" must have exactly 2 members`;
    }
    for (const userId of team.member_ids) {
      if (!LEAGUE_USER_IDS.has(userId)) {
        return `Unknown user id: ${userId}`;
      }
      if (seenUsers.has(userId)) {
        return `User ${userId} appears on more than one team`;
      }
      seenUsers.add(userId);
    }
  }

  if (seenUsers.size !== 4) {
    return "All four league users must be assigned to a team";
  }

  return null;
}

export function resolvePartnershipTeams(
  teams: PartnershipTeamInput[] | undefined,
): PartnershipTeamInput[] {
  return teams?.length ? teams : DEFAULT_PARTNERSHIP_TEAMS;
}
