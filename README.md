# Breakfast Balls

Private fantasy golf league: 4-player snake draft (6 rounds / 24 picks) on Cloudflare Workers with Next.js, D1, and live PGA standings from [balldontlie](https://pga.balldontlie.io/).

## Stack

- Next.js App Router + Tailwind
- `@opennextjs/cloudflare` → Cloudflare Workers
- Cloudflare D1 (`DB` binding)
- Cloudflare Access for production auth
- balldontlie PGA API (`BALLDONTLIE_API_KEY`)

## Local setup

```bash
npm install
npm run db:migrate:local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the **Dev user** switcher in the header (`admin` can create tournaments and start drafts).

### Secrets / env

| Name | Where | Purpose |
|------|--------|---------|
| `BALLDONTLIE_API_KEY` | Wrangler secret / `.dev.vars` | PGA standings + player search |
| Access JWT / email headers | Cloudflare Access | Production identity → `users.id` |

Create `.dev.vars` for local Worker preview:

```
BALLDONTLIE_API_KEY=your_key_here
```

### Seed users

Migration seeds:

| id | name | admin |
|----|------|-------|
| `admin` | Admin | yes |
| `player-1` … `player-4` | Player One–Four | no |

For production Access, update `users.id` values to each member’s Access email (or `sub`) so JWT/email headers map correctly.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js local dev (OpenNext Cloudflare bindings) |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:remote` | Apply D1 migrations to remote DB |
| `npm run preview` | OpenNext build + Wrangler preview |
| `npm run deploy` | OpenNext build + deploy |
| `npm run cf-typegen` | Regenerate Cloudflare `Env` types |

## Remote D1

```bash
npx wrangler d1 create breakfast-balls
# put the real database_id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put BALLDONTLIE_API_KEY
npm run deploy
```

Put Cloudflare Access in front of the Worker hostname. Map Access identities to seeded (or updated) `users` rows.

## Scoring (v1)

- **Best 4 of 6:** sum of each user’s four lowest `par_relative_score` values
- **Best single player:** lowest `par_relative_score` among all 24 drafted players
- **Custom prize rule:** stored and shown on the scoreboard; not auto-ranked yet

Standings come from `GET /pga/v1/tournament_results` (ALL-STAR tier).
