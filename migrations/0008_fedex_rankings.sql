CREATE TABLE golf_fedex_rankings (
  year TEXT NOT NULL,
  player_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (year, player_id),
  FOREIGN KEY (player_id) REFERENCES golf_players(id)
);

CREATE INDEX idx_golf_fedex_rankings_year_rank ON golf_fedex_rankings(year, rank);
