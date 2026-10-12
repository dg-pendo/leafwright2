# Leafwright

Leafwright is a storefront for independent nurseries with a merchant admin: one branded shop,
four nursery stores, one checkout, an AI concierge for shoppers, and a sales assistant for
merchants. It runs on Next.js 16 with an in-memory data layer seeded from committed JSON, so
`pnpm dev` needs nothing else.

`SPEC.md` is the product spec. `DECISIONS.md` records choices made where the spec was silent.
`PROGRESS.md` tracks milestones and gate output. `TESTIDS.md` lists `data-testid` values added
beyond the spec.

## Local setup

Requirements: Node 24+ and pnpm 11 (`corepack enable` picks up the pinned version).

```bash
pnpm install
cp .env.example .env.local        # set AUTH_SECRET: openssl rand -base64 32
pnpm exec playwright install chromium
pnpm dev                          # http://localhost:3000
```

Sign in with any seeded user and the shared password `leafwright-demo` (or `DEMO_PASSWORD`).
A few handy accounts from `seed/users.json`:

| Role    | Email                                                   | Store                                   |
| ------- | ------------------------------------------------------- | --------------------------------------- |
| Shopper | `zelda.corwin@example.com`                              | —                                       |
| Owner   | `amari.rohan@fernhollow-nursery.example.com`            | Fernhollow Nursery (pro, has Analytics) |
| Owner   | `patricia.schamberger@dry-creek-succulents.example.com` | Dry Creek Succulents (growth)           |
| Owner   | `toney.kiehn@kiln-and-vine.example.com`                 | Kiln & Vine (growth)                    |
| Owner   | `dell.ward@moss-lane.example.com`                       | Moss Lane (starter, in trial)           |

Guests can check out with just an email; any Luhn-valid card (for example
`4242 4242 4242 4242`, `12/30`, `123`) is accepted.

### Scripts

| Command                                  | What it does                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js development server, production build, production server                         |
| `pnpm typecheck`                         | `next typegen` then `tsc --noEmit`                                                      |
| `pnpm lint`                              | ESLint 9 flat config                                                                    |
| `pnpm format` / `pnpm format:check`      | Prettier                                                                                |
| `pnpm test`                              | Vitest unit tests                                                                       |
| `pnpm e2e:smoke`                         | Playwright smoke tests (starts `pnpm dev` on port 3000 unless `BASE_URL` is set)        |
| `pnpm traffic`                           | The traffic bot (see below)                                                             |
| `pnpm seed`                              | Regenerates `seed/*.json`. Do not run casually: ids are referenced by tests and the bot |

## Environment

| Variable                               | Required                       | Purpose                                                                                  |
| -------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                          | yes                            | Signs Auth.js session JWTs and the cart / order cookies                                  |
| `DEMO_PASSWORD`                        | no (default `leafwright-demo`) | Password accepted for every seeded user                                                  |
| `ANTHROPIC_API_KEY`                    | no                             | When set, the assistant answers with Claude; otherwise scripted replies                  |
| `ANTHROPIC_WORKSPACE_ID`               | no                             | Required only when the API key is not scoped to a workspace                              |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | no                             | Upstash Redis. When both are set, runtime data is stored there instead of process memory |
| `NEXT_PUBLIC_ANALYTICS_WRITE_KEY`      | no                             | Enables the in-house analytics wrapper                                                   |
| `NEXT_PUBLIC_ANALYTICS_ENDPOINT`       | no                             | Where the wrapper posts events; without it events are queued and logged                  |
| `CRON_SECRET`                          | no (recommended in production) | Bearer token Vercel Cron sends to the nightly archive route                              |

## Data

Entities are Zod schemas in `lib/db/schema.ts`. `lib/db/index.ts` is the repository, over one of
two adapters:

- **memory** (default): loads `seed/*.json` at boot; mutations last for the process.
- **kv**: when the Upstash variables are set. Seed data is still read from the JSON; Redis holds
  records created or changed at runtime (which win over the seed) and the ids of removed seed
  records. Records created by the traffic bot carry `source: "bot"` and a 14-day TTL.

Anonymous carts live in a signed cookie and merge into the user's stored cart at sign-in.

## Deploy (Vercel)

1. Push the repository to GitHub.
2. Create a Vercel project from it (framework: Next.js, root directory `/`).
3. Create an Upstash Redis database and copy its REST URL and token.
4. Set the environment variables in Vercel: `AUTH_SECRET`, `DEMO_PASSWORD`, `KV_REST_API_URL`,
   `KV_REST_API_TOKEN`, `CRON_SECRET`, and optionally `ANTHROPIC_API_KEY` and the analytics
   variables.
5. Deploy. `vercel.json` registers the nightly cron that calls
   `/api/jobs/archive-bot-products` at 03:15 UTC to archive bot products older than seven days.

Without Upstash the app still deploys, but each serverless instance has its own memory and
bot-created data will not be visible across instances or survive redeploys.

## Traffic bot

`e2e/traffic/` is a Playwright project that visits the site the way shoppers and merchants do:
10–16 shopper sessions and 3–5 merchant sessions per run, fresh browser contexts, deterministic
visitor and store rotation, human pacing, the entry-point / viewport / scenario mix from
`SPEC.md` §12, and the `lw_source=bot` cookie so the app marks what it creates.

Run it locally against a dev server:

```bash
pnpm dev                                  # in one terminal
BASE_URL=http://localhost:3000 pnpm traffic
SESSIONS=3 BASE_URL=http://localhost:3000 pnpm traffic   # three times the usual session count
```

Useful variables: `SESSIONS` (multiplier, default 1), `TRAFFIC_SEED` (replay a plan),
`TRAFFIC_RUN_NUMBER` (every tenth run adds a merchant extra), `TRAFFIC_WORKERS` (default 4),
`DEMO_PASSWORD`. Traces are kept only for failed sessions under `test-results/traffic`.

In GitHub Actions, `.github/workflows/traffic.yml` runs every two hours 06:00–23:00 UTC on
weekdays and every four hours on weekends, plus `workflow_dispatch` with a `sessions`
multiplier input. It targets the `TRAFFIC_BASE_URL` repository variable (default
`https://leafwright.vercel.app`) and reads `DEMO_PASSWORD` from repository secrets. Traces are
uploaded as an artifact only when a run fails.

## Layout

```
app/            App Router: (storefront), (account), (admin) route groups, api/ routes
components/     UI; components/ui is shadcn/ui, components/chat is the assistant
lib/            db (schemas, repository, adapters), commerce, auth, chat, flags, analytics
seed/           committed JSON generated once by scripts/seed.ts
e2e/            Playwright: smoke/ tests and traffic/ bot
```
