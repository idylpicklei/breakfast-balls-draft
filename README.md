# Breakfast Balls

Private fantasy golf league: 4-player snake draft (6 rounds / 24 picks) on Cloudflare Workers with Next.js, D1, and live PGA data from [RapidAPI Live Golf Data](https://rapidapi.com/slashgolf/api/live-golf-data).

## Stack

- Next.js App Router + Tailwind
- `@opennextjs/cloudflare` → Cloudflare Workers
- Cloudflare D1 (`DB` binding)
- Cloudflare Access for production auth
- RapidAPI Live Golf Data (`RAPID_API`)

## Data flow

1. **Sync schedule** (admin, 1 API call) → caches PGA tournaments in D1
2. **Sync field** (admin on league create, 1 API call) → caches players for draft search
3. **Draft** → search cached field only (0 API calls)
4. **Refresh scores** (admin, 1 API call per refresh) → caches leaderboard rows in D1
5. **Scoreboard** → reads D1 cache only (0 API calls for friends)

## Local setup

```bash
npm install
npm run db:migrate:local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Playing as** in the header (`admin` can sync schedule and create tournaments).

### Secrets / env

| Name | Where | Purpose |
|------|--------|---------|
| `RAPID_API` | Wrangler secret / `.dev.vars` | RapidAPI key for schedule/field/leaderboard |
| Access JWT / email headers | Cloudflare Access | Production identity → `users.id` |

Create `.dev.vars` for local Worker preview:

```
RAPID_API=your_rapidapi_key_here
```

### Seed users

| id | name | admin |
|----|------|-------|
| `admin` | Admin | yes |
| `player-1` … `player-4` | Player One–Four | no |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js local dev |
| `npm run build` | Next.js build only (OpenNext calls this) |
| `npm run cf:build` | OpenNext Cloudflare build |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:remote` | Apply D1 migrations to remote DB |
| `npm run preview` | OpenNext build + Wrangler preview |
| `npm run deploy` | OpenNext build + deploy |

### Cloudflare Workers Builds

| Setting | Value |
|---------|--------|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |

### Database migrations

Workers Builds does **not** apply D1 migrations:

```bash
npm run db:migrate:remote
```

### Auth (production)

`ALLOW_HEADER_AUTH=true` in `wrangler.jsonc` enables the “Playing as” header until Cloudflare Access is configured.

## Remote deploy

```bash
npm run db:migrate:remote
npx wrangler secret put RAPID_API
npm run deploy
```

## Admin workflow

1. Admin → **Sync schedule** for the season year
2. Select a cached PGA tournament → **Create tournament** (auto-syncs field)
3. Start draft → players search the cached field
4. After draft, admin clicks **Refresh scores** on the scoreboard (once per day)
5. Friends view scoreboard from cache — no API calls

## Scoring (v1)

- **Best 4 of 6:** lowest combined `total` from each team’s best 4 drafted players
- **Best single player:** lowest `total` among all 24 drafted players
- **Custom prize rule:** display only
