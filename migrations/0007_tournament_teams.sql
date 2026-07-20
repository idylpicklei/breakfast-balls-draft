CREATE TABLE tournament_teams (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE tournament_team_members (
  team_id TEXT NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_tournament_teams_tournament ON tournament_teams(tournament_id);

-- Seed Idaho vs Oregon for every existing tournament
INSERT INTO tournament_teams (id, tournament_id, name, sort_order)
SELECT id || '-idaho', id, 'Idaho', 1 FROM tournaments;

INSERT INTO tournament_teams (id, tournament_id, name, sort_order)
SELECT id || '-oregon', id, 'Oregon', 2 FROM tournaments;

INSERT INTO tournament_team_members (team_id, user_id)
SELECT id || '-idaho', 'Dylpickle' FROM tournaments
UNION ALL
SELECT id || '-idaho', 'MinJungKyu' FROM tournaments
UNION ALL
SELECT id || '-oregon', 'PigTank' FROM tournaments
UNION ALL
SELECT id || '-oregon', 'PaulHawk' FROM tournaments;
