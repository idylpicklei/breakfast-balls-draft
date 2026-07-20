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

Open [http://localhost:3000](http://localhost:3000) and sign in at `/login`.

### League logins

| Username | Password | Admin |
|----------|----------|-------|
| `Dylpickle` | `balls2026` | yes |
| `MinJungKyu` | `mjk2026` | no |
| `PaulHawk` | `hawk2026` | no |
| `PigTank` | `pig2026` | no |

### Secrets / env

| Name | Where | Purpose |
|------|--------|---------|
| `RAPID_API` | Worker **runtime** Secret + local `.dev.vars` | RapidAPI key for schedule/field/leaderboard |
| `SESSION_SECRET` | Worker **runtime** Secret + local `.dev.vars` | Signs login session cookies |

### Setting `RAPID_API` on Cloudflare (common “undefined” fix)

1. Worker → **Settings → Variables and Secrets** (runtime, not Build settings)
2. Add **Secret** named exactly `RAPID_API` (case-sensitive)
3. Redeploy with `--keep-vars` so dashboard secrets are not wiped (`npm run deploy` already does this)

Also set the same name under **Build → Variables and secrets** if Workers Builds needs it at build time (SSG). Runtime still requires the Worker secret above.

Local Next.js: put the key in `.env`:

```
RAPID_API=your_rapidapi_key_here
```

### League users

| Username | Role |
|----------|------|
| `Dylpickle` | Admin + drafter |
| `MinJungKyu` | Player |
| `PaulHawk` | Player |
| `PigTank` | Player |

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

### Auth

Username/password login with HttpOnly session cookies. Non-admins cannot access `/admin` or admin APIs. Set `SESSION_SECRET` via `npx wrangler secret put SESSION_SECRET` before deploying.

## Remote deploy

OpenNext is **not reliable when built on Windows** (production 500s / `ComponentMod.handler is not a function`). Build in WSL or rely on Cloudflare Workers Builds (Linux), then deploy:

```bash
# From WSL (recommended on Windows)
npm run db:migrate:remote
npx wrangler secret put RAPID_API   # once
npx wrangler secret put SESSION_SECRET   # once
npx opennextjs-cloudflare build
# deploy with authenticated wrangler (Windows host is fine if .open-next already exists):
npx wrangler deploy --keep-vars
```

Or push and let Workers Builds run `npx opennextjs-cloudflare build` + `npx wrangler deploy` on Linux.

## Admin workflow

1. Admin → **Sync schedule** for the season year
2. Select a cached PGA tournament → **Create tournament** (auto-syncs field)
3. Start draft → players search the cached field
4. After draft, admin clicks **Refresh scores** on the scoreboard (once per day)
5. Friends view scoreboard from cache — no API calls

## Scoring (v1)

- **Best 4 of 6:** lowest combined `total` from each team’s best 4 drafted players
- **Best single player:** lowest `total` among all 24 drafted players
