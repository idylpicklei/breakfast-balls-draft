-- 1. Users / Players in the League
CREATE TABLE users (
    id TEXT PRIMARY KEY, -- Cloudflare Access ID or custom UUID
    name TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE
);

-- 2. Tournaments managed by the Admin
CREATE TABLE tournaments (
    id TEXT PRIMARY KEY,
    bdl_tournament_id INTEGER UNIQUE NOT NULL, -- The balldontlie external ID
    name TEXT NOT NULL,
    status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, DRAFTING, ACTIVE, COMPLETED
    custom_prize_rule TEXT NOT NULL, -- Store admin custom rule for "Best Team"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. The Draft Session
CREATE TABLE draft_sessions (
    tournament_id TEXT PRIMARY KEY,
    current_pick INTEGER DEFAULT 1,
    draft_status TEXT DEFAULT 'PENDING', -- PENDING, LIVE, FINISHED
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id)
);

-- 4. Order of the draft positions (1 to 4)
CREATE TABLE draft_order (
    tournament_id TEXT,
    user_id TEXT,
    pick_position INTEGER, -- 1, 2, 3, or 4
    PRIMARY KEY(tournament_id, user_id),
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 5. Final Rosters / Selections
CREATE TABLE rosters (
    tournament_id TEXT,
    user_id TEXT,
    bdl_player_id INTEGER, -- balldontlie Player ID
    player_name TEXT NOT NULL,
    pick_number INTEGER NOT NULL, -- 1 through 24
    PRIMARY KEY(tournament_id, bdl_player_id),
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Seed league: replace ids with Cloudflare Access subjects (or emails) in production
INSERT INTO users (id, name, is_admin) VALUES
  ('admin', 'Admin', TRUE),
  ('player-1', 'Player One', FALSE),
  ('player-2', 'Player Two', FALSE),
  ('player-3', 'Player Three', FALSE),
  ('player-4', 'Player Four', FALSE);
