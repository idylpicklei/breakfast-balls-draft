-- Username/password auth: add credentials and remap player ids to display names
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;

INSERT INTO users (id, name, is_admin, username, password_hash) VALUES
  ('MinJungKyu', 'MinJungKyu', 0, 'MinJungKyu', 'pbkdf2:600000:lbIeq8g7jcVnkN7m3WTn2g==:SoyJgQl5ZYd4dtqumPwUr1fc1lnUWfdQBo8N3kSAW1I='),
  ('PaulHawk', 'PaulHawk', 0, 'PaulHawk', 'pbkdf2:600000:4iybh94ddULnPiH6vZmHmw==:2c0zHBdXGs6h+4+CphQkwmeQSmNchZvYewNk3YzCy0k='),
  ('PigTank', 'PigTank', 0, 'PigTank', 'pbkdf2:600000:IF0Hali+OI+wLCJjCLBfgw==:UqCDTqp2RB5i0YdgV/erlZo4krymjOHLUpXC91rNyTw='),
  ('Dylpickle', 'Dylpickle', 1, 'Dylpickle', 'pbkdf2:600000:fzTax9fvD+PvxBm0K2wx5Q==:ZAJF6IhcOmb+MxgBgjxB7A5FqpgYqDTlAXpZetd3TF8=');

UPDATE draft_order SET user_id = 'MinJungKyu' WHERE user_id = 'player-1';
UPDATE draft_order SET user_id = 'PaulHawk' WHERE user_id = 'player-2';
UPDATE draft_order SET user_id = 'PigTank' WHERE user_id = 'player-3';
UPDATE draft_order SET user_id = 'Dylpickle' WHERE user_id = 'player-4';

UPDATE rosters SET user_id = 'MinJungKyu' WHERE user_id = 'player-1';
UPDATE rosters SET user_id = 'PaulHawk' WHERE user_id = 'player-2';
UPDATE rosters SET user_id = 'PigTank' WHERE user_id = 'player-3';
UPDATE rosters SET user_id = 'Dylpickle' WHERE user_id = 'player-4';

DELETE FROM users WHERE id IN ('player-1', 'player-2', 'player-3', 'player-4', 'admin');

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
