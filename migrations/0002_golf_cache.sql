-- PGA metadata cache (RapidAPI Live Golf Data)
CREATE TABLE golf_tournaments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    status TEXT,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE golf_players (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    status TEXT
);

CREATE TABLE golf_tournament_field (
    tournament_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    PRIMARY KEY (tournament_id, player_id),
    FOREIGN KEY (tournament_id) REFERENCES golf_tournaments(id),
    FOREIGN KEY (player_id) REFERENCES golf_players(id)
);

-- Migrate fantasy tournaments: bdl_tournament_id -> external_tournament_id + year
CREATE TABLE tournaments_new (
    id TEXT PRIMARY KEY,
    external_tournament_id TEXT UNIQUE NOT NULL,
    year TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'SCHEDULED',
    custom_prize_rule TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tournaments_new (id, external_tournament_id, year, name, status, custom_prize_rule, created_at)
SELECT id, CAST(bdl_tournament_id AS TEXT), '2026', name, status, custom_prize_rule, created_at
FROM tournaments;

DROP TABLE tournaments;
ALTER TABLE tournaments_new RENAME TO tournaments;

-- Migrate rosters: bdl_player_id -> player_id
CREATE TABLE rosters_new (
    tournament_id TEXT,
    user_id TEXT,
    player_id TEXT,
    player_name TEXT NOT NULL,
    pick_number INTEGER NOT NULL,
    PRIMARY KEY (tournament_id, player_id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO rosters_new (tournament_id, user_id, player_id, player_name, pick_number)
SELECT tournament_id, user_id, CAST(bdl_player_id AS TEXT), player_name, pick_number
FROM rosters;

DROP TABLE rosters;
ALTER TABLE rosters_new RENAME TO rosters;
