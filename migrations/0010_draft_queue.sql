CREATE TABLE draft_queues (
  tournament_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (tournament_id, user_id, player_id),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE draft_user_settings (
  tournament_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  autodraft_enabled INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tournament_id, user_id),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
