ALTER TABLE tournaments ADD COLUMN pick_clock_seconds INTEGER NOT NULL DEFAULT 60;
ALTER TABLE draft_sessions ADD COLUMN pick_deadline_at TEXT;
