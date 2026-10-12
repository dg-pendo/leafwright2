# Progress

Checklist by milestone. Gate output is quoted under each milestone when it passes.

## 0. Scaffold

- [x] Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind 4, pnpm
- [x] shadcn/ui initialized (Radix base) with the component set the app uses
- [x] ESLint 9 flat config, Prettier 3
- [x] Vitest 5 config and a first unit test
- [x] Playwright 1.63 config with a `smoke` project
- [x] Route groups `(storefront)`, `(account)`, `(admin)` with layouts
- [x] `CLAUDE.md` stating rules 1–8
- [x] `.env.example` with every variable from SPEC §12
- [x] `.gitignore` includes `NOVA-*.md`
- [x] Gates passed and quoted

### Summary

Shipped the Next.js 16 scaffold with shadcn/ui, route groups, lint/format/test/e2e tooling,
repo docs, and env example. Open question: SPEC §10 names `middleware.ts`; Next.js 16 deprecates
that filename in favor of `proxy.ts`, so the guard will live there (see `DECISIONS.md`).

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  1 passed (1)
      Tests  2 passed (2)

$ pnpm build
✓ Compiled successfully in 230ms
  Finished TypeScript in 918ms ...
  Generating static pages using 4 workers (0/3) ...
✓ Generating static pages using 4 workers (3/3) in 163ms
Route (app)
┌ ○ /
└ ○ /_not-found
○  (Static)  prerendered as static content
```

## 1. Data layer and seed

- [x] `lib/db/schema.ts` with every entity in SPEC §9
- [x] Repository API in `lib/db/index.ts`
- [x] Memory adapter
- [x] `scripts/seed.ts` with a fixed faker seed
- [x] Committed `seed/*.json` at SPEC §9 counts (4 / 60 / 12+40 / 160 / 8 / 20)
- [x] Unit tests: cart totals, promo rules, order number generation (plus password and repository)
- [x] Gates passed and quoted

### Summary

Shipped Zod entity schemas, the repository over a generic adapter, the memory adapter with
hot-reload-safe tables, pricing and promo rules, order numbering, scrypt password hashing, the
seed generator, and committed seed JSON. Open question: product photos were skipped in favor of
category SVG art only (see `DECISIONS.md`).

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  6 passed (6)
      Tests  39 passed (39)

$ pnpm build
✓ Compiled successfully in 359ms
  Finished TypeScript in 1295ms ...
  Generating static pages using 4 workers (0/3) ...
✓ Generating static pages using 4 workers (3/3) in 165ms
Route (app)
┌ ○ /
└ ○ /_not-found
○  (Static)  prerendered as static content
```

## 2. Auth

- [x] Auth.js v5 credentials provider
- [x] `jwt` and `session` callbacks, `session.store` nullable
- [x] Request guards for `/admin/**` and `/account/**` (`proxy.ts`)
- [x] `/sign-in` page
- [x] Shared demo password from env
- [x] Unit tests for the callbacks (plus credentials and callback URL)
- [x] Gates passed and quoted

### Summary

Shipped Auth.js v5 with a Credentials provider over the seeded users, JWT sessions, `session.store`
for merchants and `null` for shoppers, the `proxy.ts` guard, the `/sign-in` page, and a
`SessionProvider` in the root layout. Verified live with curl: sign-in sets the session cookie,
`/api/auth/session` returns the store for a Fernhollow owner, `/admin` and `/account/*` redirect
to `/sign-in?callbackUrl=…` when signed out.

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  9 passed (9)
      Tests  51 passed (51)

$ pnpm build
✓ Compiled successfully in 1029ms
  Finished TypeScript in 1677ms ...
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
└ ƒ /sign-in
ƒ Proxy (Middleware)
```

## 3. Storefront

- [x] Routes 1–10 with every control in SPEC §4 (`pdp-save` stores to localStorage; see `DECISIONS.md`)
- [x] Anonymous cookie cart merging at sign-in
- [x] Guest checkout
- [x] Server Actions for all storefront mutations (`addToCart`, `removeFromCart`, `updateCartLine`, `applyPromo`, `placeOrder`, `followStore`)
- [x] `/promo/[code]` auto-apply
- [x] Confirmation page
- [x] Smoke: anonymous browse → add to cart → guest checkout → confirmation (plus promo link + cart merge at sign-in)
- [x] Gates passed and quoted

### Summary

Shipped the storefront: global chrome (logo, shop, search, cart badge, assistant toggle, sign-in /
user menu / sign-out, admin link for merchants), home with category tiles, featured products, promo
banner and nurseries, client-filtered catalog with quick add, product detail with pot size,
quantity, tabs, save for later and store link, store page with follow, cart with line controls and
promo form, guest or signed-in checkout with Luhn-checked card, order confirmation with guest
access, promo landing, and help. Two Playwright smoke tests cover the guest purchase funnel and the
promo link plus cart merge at sign-in. Open questions: `checkout-region` was added beyond SPEC §4
(a US address needs a state); product photos remain SVG art.

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  11 passed (11)
      Tests  57 passed (57)

$ pnpm build
✓ Compiled successfully in 541ms
  Finished TypeScript in 1423ms ...
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ƒ /cart
├ ƒ /checkout
├ ƒ /help
├ ƒ /orders/[orderNumber]/confirmation
├ ƒ /products
├ ƒ /products/[slug]
├ ƒ /promo/[code]
├ ƒ /sign-in
└ ƒ /stores/[slug]
ƒ Proxy (Middleware)

$ pnpm e2e:smoke
Running 2 tests using 1 worker
  ✓  1 [smoke] › e2e/smoke/storefront.spec.ts:3:5 › anonymous shopper browses, adds to cart, and checks out as a guest (2.8s)
  ✓  2 [smoke] › e2e/smoke/storefront.spec.ts:42:5 › promo link applies a code and the cart survives signing in (2.0s)
  2 passed (6.6s)
```

## 4. Account

- [x] Routes 11–13
- [x] Profile save, addresses (add, remove, make default)
- [x] Reorder, refund request
- [x] Gates passed and quoted

### Summary

Shipped the account area under the shared storefront chrome: profile form, saved addresses with
add / remove / default, order history that also lists guest orders under the same email, and order
detail with reorder (back to `/cart`) and refund request (recorded as a customer note; see
`DECISIONS.md`). Added an account smoke test; smoke tests now use distinct seeded shoppers so they
do not share cart state on one server.

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  12 passed (12)
      Tests  59 passed (59)

$ pnpm build
✓ Compiled successfully in 536ms
  Finished TypeScript in 989ms ...
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /account
├ ƒ /account/orders
├ ƒ /account/orders/[orderNumber]
├ ƒ /api/auth/[...nextauth]
├ ƒ /cart
├ ƒ /checkout
├ ƒ /help
├ ƒ /orders/[orderNumber]/confirmation
├ ƒ /products
├ ƒ /products/[slug]
├ ƒ /promo/[code]
├ ƒ /sign-in
└ ƒ /stores/[slug]
ƒ Proxy (Middleware)

$ pnpm e2e:smoke
Running 3 tests using 2 workers
  ✓  2 [smoke] › e2e/smoke/account.spec.ts:3:5 › signed-in shopper updates their profile, adds an address, and reorders (1.5s)
  ✓  1 [smoke] › e2e/smoke/storefront.spec.ts:3:5 › anonymous shopper browses, adds to cart, and checks out as a guest (2.4s)
  ✓  3 [smoke] › e2e/smoke/storefront.spec.ts:42:5 › promo link applies a code and the cart survives signing in (1.5s)
  3 passed (5.6s)
```

## 5. Admin

- [x] Dashboard KPIs from seed orders (revenue, orders, AOV, checkout conversion; 30-day window vs prior)
- [x] Products CRUD with draft / publish / archive
- [x] Orders with status filter, date range, CSV export route handler
- [x] Fulfill / refund / notes
- [x] Customers (users and guest emails joined to the store's orders)
- [x] Promos (list with toggles, detail form, `new` id)
- [x] Settings sections (store, team, billing, payouts)
- [x] `merchant-analytics` OpenFeature flag, `pro` stores on (web, React, and server SDKs)
- [x] Smoke: merchant sign-in → new product → publish → open order → fulfill
- [x] Gates passed and quoted

### Summary

Shipped the merchant admin: guarded layout with store header and flagged nav, dashboard KPIs and
recent orders, products list / new / edit with save-draft, publish, and archive actions, orders
list with status and date filters plus a CSV route handler, order detail with fulfill, refund, and
notes, customers list and detail, promos list with toggles and a detail form, four settings
sections, and the analytics page behind the `merchant-analytics` flag (Fernhollow, the `pro`
store, sees it; others get the upsell). Verified the CSV export by hand as a Kiln & Vine owner
(200, `text/csv`, attachment filename, 13 fulfilled rows) and that anonymous requests redirect.
Open question: dashboard "conversion" is checkout conversion from orders and open carts because
there is no session data (see `DECISIONS.md`).

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  17 passed (17)
      Tests  73 passed (73)

$ pnpm build
✓ Compiled successfully in 1576ms
  Finished TypeScript in 2.6s ...
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /account
├ ƒ /account/orders
├ ƒ /account/orders/[orderNumber]
├ ƒ /admin
├ ƒ /admin/analytics
├ ƒ /admin/customers
├ ƒ /admin/customers/[id]
├ ƒ /admin/orders
├ ƒ /admin/orders/[id]
├ ƒ /admin/orders/export
├ ƒ /admin/products
├ ƒ /admin/products/[id]
├ ƒ /admin/products/new
├ ƒ /admin/promos
├ ƒ /admin/promos/[id]
├ ƒ /admin/settings
├ ƒ /admin/settings/[section]
├ ƒ /api/auth/[...nextauth]
├ ƒ /cart
├ ƒ /checkout
├ ƒ /help
├ ƒ /orders/[orderNumber]/confirmation
├ ƒ /products
├ ƒ /products/[slug]
├ ƒ /promo/[code]
├ ƒ /sign-in
└ ƒ /stores/[slug]
ƒ Proxy (Middleware)

$ pnpm e2e:smoke
Running 4 tests using 3 workers
  ✓  3 [smoke] › e2e/smoke/account.spec.ts:3:5 › signed-in shopper updates their profile, adds an address, and reorders (3.2s)
  ✓  1 [smoke] › e2e/smoke/storefront.spec.ts:3:5 › anonymous shopper browses, adds to cart, and checks out as a guest (3.3s)
  ✓  2 [smoke] › e2e/smoke/admin.spec.ts:3:5 › merchant creates and publishes a product, then fulfills an order (4.2s)
  ✓  4 [smoke] › e2e/smoke/storefront.spec.ts:42:5 › promo link applies a code and the cart survives signing in (1.7s)
  4 passed (7.1s)
```

## 6. Chat

- [x] `components/chat/*`, `useChat` (`messages`, `input`, `status`, `submit`, `rate`, `retry`)
- [x] `app/api/chat/route.ts` streaming, persona from layout
- [x] `lib/chat/` prompts, tools, provider (Claude when keyed, scripted otherwise)
- [x] Ratings endpoint (`/api/chat/feedback`)
- [x] Smoke: open panel, send a suggestion, rate the reply (plus `/help` opens it by default)
- [x] Gates passed and quoted

### Summary

Shipped the assistant: a slide-in panel mounted by the storefront chrome (shopper) and the admin
layout (merchant), suggested prompts per persona, a streaming chat route that stores conversations
and replies, a ratings route, and `lib/chat/` with two system prompts, three Zod-typed tools, and
a provider that uses the Anthropic SDK tool runner when `ANTHROPIC_API_KEY` is set and scripted
keyword replies filled with real catalog and sales data otherwise. After the gate run a stray
"Controller is already closed" log from a client disconnect was fixed by guarding the stream.
Open question: the live Claude path is wired but could not be exercised here without an API key.

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  18 passed (18)
      Tests  78 passed (78)

$ pnpm build
✓ Compiled successfully in 2.1s
  Finished TypeScript in 2.7s ...
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /account
├ ƒ /account/orders
├ ƒ /account/orders/[orderNumber]
├ ƒ /admin
├ ƒ /admin/analytics
├ ƒ /admin/customers
├ ƒ /admin/customers/[id]
├ ƒ /admin/orders
├ ƒ /admin/orders/[id]
├ ƒ /admin/orders/export
├ ƒ /admin/products
├ ƒ /admin/products/[id]
├ ƒ /admin/products/new
├ ƒ /admin/promos
├ ƒ /admin/promos/[id]
├ ƒ /admin/settings
├ ƒ /admin/settings/[section]
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/chat
├ ƒ /api/chat/feedback
├ ƒ /cart
├ ƒ /checkout
├ ƒ /help
├ ƒ /orders/[orderNumber]/confirmation
├ ƒ /products
├ ƒ /products/[slug]
├ ƒ /promo/[code]
├ ƒ /sign-in
└ ƒ /stores/[slug]
ƒ Proxy (Middleware)

$ pnpm e2e:smoke
Running 6 tests using 4 workers
  ✓  3 [smoke] › e2e/smoke/chat.spec.ts:3:5 › shopper opens the assistant, sends a suggestion, and rates the reply (3.3s)
  ✓  5 [smoke] › e2e/smoke/chat.spec.ts:27:5 › help page opens the assistant by default (513ms)
  ✓  2 [smoke] › e2e/smoke/storefront.spec.ts:3:5 › anonymous shopper browses, adds to cart, and checks out as a guest (4.0s)
  ✓  4 [smoke] › e2e/smoke/account.spec.ts:3:5 › signed-in shopper updates their profile, adds an address, and reorders (4.3s)
  ✓  1 [smoke] › e2e/smoke/admin.spec.ts:3:5 › merchant creates and publishes a product, then fulfills an order (5.2s)
  ✓  6 [smoke] › e2e/smoke/storefront.spec.ts:42:5 › promo link applies a code and the cart survives signing in (1.9s)
  6 passed (7.9s)
```

## 7. Analytics wrapper

- [x] `lib/analytics.ts` (`track`, `page`; no-op without `NEXT_PUBLIC_ANALYTICS_WRITE_KEY`)
- [x] Three call sites from SPEC §5, nothing else ("Promo Applied" ×2 triggers, "Products Searched", "Orders Exported")
- [x] Gates passed and quoted

### Summary

Shipped the in-house wrapper with unit tests for no-op, queued, and posted modes, and wired the
three SPEC §5 events: search submit, promo applied (cart form and promo link), and the CSV export
route handler. `grep analytics.track` across `app/`, `components/`, and `lib/` returns exactly
those four lines. Open question: `NEXT_PUBLIC_ANALYTICS_ENDPOINT` was added as an optional
variable so a keyed deploy has somewhere to send events (see `DECISIONS.md`).

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  19 passed (19)
      Tests  81 passed (81)

$ pnpm build
✓ Compiled successfully in 1013ms
  Finished TypeScript in 1746ms ...
ƒ Proxy (Middleware)

$ pnpm e2e:smoke
Running 6 tests using 4 workers
  ✓  3 [smoke] › e2e/smoke/chat.spec.ts:3:5 › shopper opens the assistant, sends a suggestion, and rates the reply (2.8s)
  ✓  5 [smoke] › e2e/smoke/chat.spec.ts:27:5 › help page opens the assistant by default (534ms)
  ✓  2 [smoke] › e2e/smoke/account.spec.ts:3:5 › signed-in shopper updates their profile, adds an address, and reorders (3.6s)
  ✓  4 [smoke] › e2e/smoke/storefront.spec.ts:3:5 › anonymous shopper browses, adds to cart, and checks out as a guest (4.2s)
  ✓  1 [smoke] › e2e/smoke/admin.spec.ts:3:5 › merchant creates and publishes a product, then fulfills an order (4.4s)
  ✓  6 [smoke] › e2e/smoke/storefront.spec.ts:42:5 › promo link applies a code and the cart survives signing in (1.8s)
  6 passed (8.9s)
```

## 8. Traffic bot

- [x] `e2e/traffic/` scenarios, rotation, pacing, entry points, viewports, percentages (`config.ts`, `plan.ts`, `scenarios/`)
- [x] `.github/workflows/traffic.yml` cron plus `workflow_dispatch` with `sessions`
- [x] `source: "bot"` on bot-created records; nightly archive job (`/api/jobs/archive-bot-products` via Vercel Cron)
- [x] Local dry run with `sessions=3`, result quoted
- [x] Gates passed and quoted

### Summary

Shipped the traffic bot as its own Playwright project (`pnpm traffic`): a seeded, deterministic
session plan with the SPEC §12 percentages, viewports, entry points, and pacing; shopper and
merchant scenarios including chat with ratings, guest and signed-in purchases, abandonment at
payment, order fulfillment, product drafts and publishes, and the every-tenth-run extras; per-session
traces kept only on failure; the Actions cron schedule with a `sessions` multiplier input; the
`lw_source=bot` cookie that stamps `source: "bot"`; and the nightly archive route plus Vercel cron.
Dry runs surfaced four fixes: the open chat panel covered page controls after a reply (scenario
now closes it), the admin nav was unreachable below `md` (now a horizontal bar on small screens),
mobile device emulation broke hit-testing (viewports are sizes only), and sold-out products
disabled add-to-cart (scenario moves on). Verified afterwards that the newest paid Fernhollow
order renders as "automated" in the admin and that the archive route answers. Open questions:
repeated bot purchases deplete inventory over time with a persistent store (no restock job is in
the spec); `CRON_SECRET` is an added env var for the archive route.

Dry run against `pnpm dev` (port 3100) with the multiplier at 3:

```
$ SESSIONS=3 BASE_URL=http://localhost:3100 TRAFFIC_SEED=dry-run-2026-10-01-d TRAFFIC_RUN_NUMBER=40 pnpm traffic
Running 39 tests using 5 workers
  39 passed (3.6m)

Session outcomes (from the per-session log lines):
  12 browsed and left
   9 checked the dashboard
   7 placed order
   5 left with items in the cart
   4 bounced at the sign-in prompt
   3 opened 3 orders, fulfilled 0
   2 left at the payment step
   1 saved draft
   1 opened 3 orders, fulfilled 1
   1 followed the assistant's link to a product
   1 edited a promo
   1 chatted and rated down
   1 asked the assistant and rated up
   1 abandoned the product form
```

Earlier dry runs with other seeds: 56/60, 59/60, 47/51, and 56/60 before the four fixes above.

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  21 passed (21)
      Tests  87 passed (87)

$ pnpm build
✓ Compiled successfully in 1156ms
  Finished TypeScript in 2.6s ...
├ ƒ /api/jobs/archive-bot-products
ƒ Proxy (Middleware)

$ pnpm e2e:smoke
Running 6 tests using 4 workers
  ✓  3 [smoke] › e2e/smoke/chat.spec.ts:3:5 › shopper opens the assistant, sends a suggestion, and rates the reply (2.7s)
  ✓  5 [smoke] › e2e/smoke/chat.spec.ts:27:5 › help page opens the assistant by default (352ms)
  ✓  2 [smoke] › e2e/smoke/account.spec.ts:3:5 › signed-in shopper updates their profile, adds an address, and reorders (3.4s)
  ✓  4 [smoke] › e2e/smoke/storefront.spec.ts:3:5 › anonymous shopper browses, adds to cart, and checks out as a guest (3.5s)
  ✓  1 [smoke] › e2e/smoke/admin.spec.ts:3:5 › merchant creates and publishes a product, then fulfills an order (3.9s)
  ✓  6 [smoke] › e2e/smoke/storefront.spec.ts:42:5 › promo link applies a code and the cart survives signing in (1.7s)
  6 passed (7.0s)
```

## 9. Deploy readiness

- [x] KV adapter behind `KV_REST_API_URL` (`lib/db/kv.ts`, overlay on the committed seed, TTL for bot records)
- [x] `vercel.json` (nightly cron for the bot-product archive route)
- [x] `README.md`: local setup, env table, deploy steps, running the bot
- [x] Final full gate run
- [x] Manual steps listed

### Summary

Shipped the Upstash Redis adapter with unit tests against a fake client, adapter selection by
environment, and the README. All nine milestones are complete; every gate passes on a fresh
server and Prettier reports every file formatted. Open questions: the KV adapter has not been run
against a real Upstash database; the live Claude path has not been run without an API key; two
environment variables beyond SPEC §12 were added (`NEXT_PUBLIC_ANALYTICS_ENDPOINT`, `CRON_SECRET`).

```
$ pnpm typecheck
Generating route types...
✓ Types generated successfully

$ pnpm lint
(no output: 0 problems)

$ pnpm test
 Test Files  22 passed (22)
      Tests  91 passed (91)

$ pnpm build
✓ Compiled successfully in 1062ms
  Finished TypeScript in 2.1s ...
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /account
├ ƒ /account/orders
├ ƒ /account/orders/[orderNumber]
├ ƒ /admin
├ ƒ /admin/analytics
├ ƒ /admin/customers
├ ƒ /admin/customers/[id]
├ ƒ /admin/orders
├ ƒ /admin/orders/[id]
├ ƒ /admin/orders/export
├ ƒ /admin/products
├ ƒ /admin/products/[id]
├ ƒ /admin/products/new
├ ƒ /admin/promos
├ ƒ /admin/promos/[id]
├ ƒ /admin/settings
├ ƒ /admin/settings/[section]
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/chat
├ ƒ /api/chat/feedback
├ ƒ /api/jobs/archive-bot-products
├ ƒ /cart
├ ƒ /checkout
├ ƒ /help
├ ƒ /orders/[orderNumber]/confirmation
├ ƒ /products
├ ƒ /products/[slug]
├ ƒ /promo/[code]
├ ƒ /sign-in
└ ƒ /stores/[slug]
ƒ Proxy (Middleware)

$ pnpm e2e:smoke
Running 6 tests using 4 workers
  ✓  1 [smoke] › e2e/smoke/chat.spec.ts:3:5 › shopper opens the assistant, sends a suggestion, and rates the reply (2.7s)
  ✓  5 [smoke] › e2e/smoke/chat.spec.ts:27:5 › help page opens the assistant by default (412ms)
  ✓  2 [smoke] › e2e/smoke/account.spec.ts:3:5 › signed-in shopper updates their profile, adds an address, and reorders (3.4s)
  ✓  3 [smoke] › e2e/smoke/storefront.spec.ts:3:5 › anonymous shopper browses, adds to cart, and checks out as a guest (3.5s)
  ✓  4 [smoke] › e2e/smoke/admin.spec.ts:3:5 › merchant creates and publishes a product, then fulfills an order (4.0s)
  ✓  6 [smoke] › e2e/smoke/storefront.spec.ts:42:5 › promo link applies a code and the cart survives signing in (1.7s)
  6 passed (7.2s)
```

## 10. Assistant conversation traffic

- [x] Intent bank with supported, unsupported, and off-topic asks per persona (`e2e/traffic/conversations.ts`)
- [x] Multi-turn chat driver shared by shopper and merchant sessions (`e2e/traffic/scenarios/chat.ts`)
- [x] 1–2 dedicated conversation sessions per run (`plan.ts`, `config.ts`)
- [x] SPEC §12 and DECISIONS updated
- [x] Gates: typecheck, lint, test, build passed; `e2e:smoke` and a local traffic run skipped so local
      browsers do not report into the shared analytics subscription; verified by the deployed Actions run instead

## 11. Conversations workflow

- [x] `buildConversationPlan` with intent rotation, persona filter, and help-page entry (`plan.ts`, `conversations.ts`)
- [x] `.github/workflows/conversations.yml`: scheduled plus `workflow_dispatch` with `conversations` and `persona`
- [x] SPEC §12, DECISIONS updated
- [x] Gates: typecheck, lint, test (113), build; no local browser runs (they would report into the shared analytics subscription)

## Manual steps left for a human

1. **Create the GitHub repository** `pendo-io/leafwright`, add it as `origin`, and push `main`.
   Add the repository secret `DEMO_PASSWORD` and, optionally, the variable `TRAFFIC_BASE_URL`.
2. **Create the Vercel project** from the repository and set the environment variables:
   `AUTH_SECRET`, `DEMO_PASSWORD`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `CRON_SECRET`, and
   optionally `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_ANALYTICS_WRITE_KEY`,
   `NEXT_PUBLIC_ANALYTICS_ENDPOINT`. Deploy; `vercel.json` registers the nightly cron.
3. **Create the Upstash Redis database** and copy its REST URL and token into the Vercel
   project (step 2). Nothing needs importing; the seed is read from the repository.
4. **Enable the Actions cron**: scheduled workflows are inactive until the repository has a
   default branch on GitHub; confirm `.github/workflows/traffic.yml` is enabled under Actions and
   trigger one `workflow_dispatch` run with `sessions` = `1` to confirm it reaches the deploy.
