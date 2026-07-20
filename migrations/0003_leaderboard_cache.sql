CREATE TABLE golf_leaderboard_rows (
    tournament_id TEXT NOT NULL,
    year TEXT NOT NULL,
    player_id TEXT NOT NULL,
    position TEXT,
    total REAL,
    current_round_score TEXT,
    current_hole TEXT,
    thru TEXT,
    first_name TEXT,
    last_name TEXT,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tournament_id, year, player_id)
);

CREATE TABLE golf_leaderboard_meta (
    tournament_id TEXT NOT NULL,
    year TEXT NOT NULL,
    round_status TEXT,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tournament_id, year)
);
