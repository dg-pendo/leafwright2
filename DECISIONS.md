# Decisions

Choices made where `SPEC.md` is silent or where the stack has moved since it was written.
Newest at the bottom.

## Milestone 0: scaffold

- **Package versions.** Next.js 16.3.8, React 19.3, TypeScript 5.9.3 (pinned with `~` because
  TypeScript 7 is already on npm and the spec asks for 5.9), Tailwind 4.3, ESLint 9.39 (ESLint 10
  is out; the spec asks for a 9 flat config), Prettier 3.9, Vitest 5.0, Playwright 1.63.0, Zod 4,
  Auth.js `5.0.0-beta.32`, `@anthropic-ai/sdk` 0.131 (the spec's 0.130 has been superseded by a
  patch release in the same line).
- **Node.** Local machine runs Node 26; `engines` asks for `>=24` as the spec says, and CI uses 24.
- **shadcn/ui.** Initialized with the `radix` component base and the `nova` preset, neutral base
  color, CSS variables. shadcn 4 ships `radix-ui` as one package and `cn` as a dependency; we keep
  its generated `lib/utils.ts` as the `cn` export.
- **Request guard file.** Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts` (same
  mechanism, Node runtime, deprecation warning on the old name). The guard the spec calls
  `middleware.ts` lives at `proxy.ts` with a `proxy` export.
- **Scripts.** `typecheck` is `tsc --noEmit`; `lint` is `eslint .`; `test` is `vitest run`;
  `e2e:smoke` is the `smoke` Playwright project from `e2e/playwright.config.ts`. The traffic bot
  gets its own config under `e2e/traffic/`.
- **Vitest environment.** Node by default; `components/**` tests run under jsdom.
- **Formatting.** Prettier with the Tailwind class-sorting plugin, 100-column width, double
  quotes, trailing commas. `eslint-config-prettier` turns off conflicting ESLint style rules.
- **pnpm.** `minimumReleaseAge` is set to 0 in `pnpm-workspace.yaml` so freshly released
  framework patches install without the loose-mode warnings pnpm 11 prints otherwise. Build
  scripts are allowed for `esbuild` and `sharp` only.

## Milestone 1: data layer and seed

- **Money as integer cents.** Every price, total, and fixed promo value is an integer number of
  cents. `formatMoney` in `lib/commerce/cart.ts` renders it.
- **Dates as ISO strings.** Entities store timestamps as ISO 8601 strings (`z.iso.datetime()`)
  so the JSON seed and the KV adapter round-trip without conversion.
- **Ids.** Seed ids are readable and sequential (`store_fernhollow`, `prod_0042`, `order_0160`).
  App-created records use `newId(prefix)` from `lib/db/ids.ts` (prefix plus 16 hex chars).
- **`source` field.** `Product`, `Order`, and `Conversation` carry `source: "seed" | "app" |
"bot"` (default `app`). SPEC §12 needs `source: "bot"` on bot-created records; the repository
  gives bot records a 14-day TTL on write so the KV adapter can expire them (SPEC §9).
- **One order per store.** A cart can hold products from several stores, but `Order.storeId` is
  singular, so checkout creates one order per store in the cart. Pricing in `priceCart` groups
  lines by store; shipping and tax are computed per group and a promo only discounts the lines
  of the store that issued it. The confirmation page shows the first order and links to siblings.
- **Pricing rules.** Standard shipping is $7.99 per store, free when that store's discounted
  subtotal reaches $75; express is $14.99. Tax is a flat 8% of the discounted subtotal. Percent
  promos round to the nearest cent and are capped at the subtotal; fixed promos are capped at the
  subtotal; `free_shipping` zeroes that store's shipping.
- **One cart line per product.** Adding a product that is already in the cart increments its
  quantity and, if a pot size was chosen, switches the line to that size. This keeps
  `cart-qty-{slug}` and `cart-remove-{slug}` unique per page as SPEC §4 requires.
- **Cart merge.** Anonymous lines are added to the user's cart (quantities summed); the user's
  promo code wins, otherwise the anonymous code carries over.
- **Passwords.** `passwordHash` is `scrypt$<salt>$<key>` from `lib/auth/password.ts`. Seeded
  hashes are of `leafwright-demo`; `DEMO_PASSWORD` (SPEC §10 "overridable by env") is also
  accepted for every seeded user at sign-in.
- **Repository shape.** `lib/db/index.ts` exports a `db` object with per-collection methods
  (`list`, `getById`, `getBySlug`, `create`, `update`, …) over an `Adapter` with four generic
  operations (`get`, `list`, `put`, `remove`). Writes are re-validated through the entity schema.
  The memory adapter keeps its tables on `globalThis` so dev hot reloads keep mutations.
- **Product search.** Catalog search matches name, description, and category, case-insensitive.
  Sort options are `featured` (name), `newest`, `price-asc`, `price-desc`.
- **Seed reference date.** The generator uses a fixed "now" of 2026-10-01T12:00Z and faker seed
  `20261001`. Orders span the 90 days before it. Moss Lane's trial ends 11 days after it.
- **Images.** Each category has one self-hosted SVG card art in `public/products/`. The spec's
  "few public-domain photos" were skipped so the repo has no third-party assets to attribute;
  products reference the category art.
- **Variants.** Tropicals and rare plants ship in 4"/6"/8" pots, succulents in 2"/4", planters in
  Small/Medium/Large, tools have no variants. Product `inventory` is the sum of variant inventory
  when variants exist.
- **Seed distribution.** 48 published / 8 draft / 4 archived products; orders split 60/40/40/20
  across Fernhollow, Dry Creek, Kiln & Vine, Moss Lane; 23 guest orders; 30 with a promo.

## Milestone 2: auth

- **Guard file.** The route guard is `proxy.ts` exporting `proxy = auth(...)` with a matcher for
  `/admin/:path*` and `/account/:path*`, as Auth.js documents for Next.js 16. Signed-out users
  are sent to `/sign-in?callbackUrl=…`; signed-in shoppers who hit `/admin` are sent home.
- **Callbacks as plain functions.** `jwtCallback` and `sessionCallback` live in
  `lib/auth/callbacks.ts` with injectable dependencies (`stampSignIn`, `loadStore`) so they are
  unit-tested without Auth.js. `auth.ts` just forwards to them.
- **Fresh store on every session read.** The `session` callback loads the store by id each time
  rather than copying plan/trial onto the token, so a plan change shows up without re-signing in.
- **`trustHost: true`.** The demo runs on localhost, Vercel previews, and GitHub Actions; host
  trust is on rather than enumerated.
- **Sign-in form.** A client component with `useActionState` posting to a Server Action that calls
  `signIn("credentials", …)` and maps `AuthError` to one generic message. Only same-origin paths
  are honored as `callbackUrl` (`lib/auth/callback-url.ts`).
- **Local env.** `.env.local` (gitignored) holds `AUTH_SECRET` and `DEMO_PASSWORD` for `pnpm dev`.

## Milestone 3: storefront

- **Anonymous cart in the cookie itself.** The signed `lw_cart` cookie carries `{ id, lines,
promoCode }` (HMAC-SHA256 with `AUTH_SECRET`, `lib/cookies.ts`), so guests need no server
  state. Signed-in users' carts live in the `carts` collection keyed by `userId`. At sign-in the
  action verifies credentials, merges the cookie cart into the stored cart, deletes the cookie,
  then hands off to Auth.js.
- **Server Actions per route folder.** `cart/actions.ts` (add, update line, remove, apply/remove
  promo), `checkout/actions.ts` (`placeOrder`), `stores/[slug]/actions.ts` (`followStore`),
  `sign-in/actions.ts`. Non-action helpers (schemas, `saveAddress`) live under `lib/orders/` so a
  `"use server"` file exports only actions.
- **Catalog filtering on the client.** `/products` loads every published product on the server
  and a client view reads `?category=`, `?sort=`, `?q=` with `useSearchParams` (SPEC §3), filters
  and sorts in memory, and rewrites the URL from the two shadcn selects.
- **Quick add** uses the first variant and quantity 1 and only refreshes the cart badge; the PDP
  add shows an inline "Added …" status via `useActionState`.
- **Save for later** (`pdp-save`) keeps slugs in `localStorage`; there is no saved-items entity in
  SPEC §9 and the control is slated for removal in backlog #3.
- **Checkout address needs a state.** SPEC §4 lists name, address 1/2, city, postal, phone; a US
  address also needs a region, so `checkout-region` was added and recorded in `TESTIDS.md`. Guests
  get a `checkout-sign-in` link; the save-address checkbox is shown to signed-in users only.
- **Orders are created as `paid`.** There is no payment provider (SPEC §15); a Luhn-valid card with
  an unexpired `MM/YY` and 3–4 digit code is accepted and the order skips `placed`.
- **Inventory and promo usage** are decremented/incremented in `placeOrder`; the cart is cleared
  and the user lands on the first order's confirmation. Sibling orders from the same checkout are
  linked from the confirmation.
- **Guest access to confirmations.** A signed `lw_orders` cookie remembers up to 20 order numbers
  placed in this browser. Signed-in buyers and the order's merchants can always view it.
- **Promo landing is a page, not a route handler.** `/promo/[code]` renders a client component
  that calls the `applyPromoCode` action on mount and then replaces the URL with `/products`.
  Server components cannot set cookies, and the client hop is where the analytics call will live.
- **Bot marker.** `placeOrder` stamps `source` from the `lw_source` cookie (`bot` when present),
  read by `lib/request-source.ts`. The traffic bot sets that cookie on its contexts.
- **Assistant toggle** is wired to an `AssistantProvider` context now so the header control exists;
  the panel itself arrives in milestone 6, and `/help` opens it on mount.

## Milestone 4: account

- **Shared chrome.** `(account)` reuses the storefront header, footer, and assistant context via
  `components/storefront/storefront-chrome.tsx`, with a small Profile / Orders sub-nav.
- **Order history includes guest orders.** `ordersForUser` returns orders with the user's
  `customerId` plus guest orders placed under the same email, which is what the help page promises.
- **Refund request is a note.** `Order` in SPEC §9 has no refund-request field, so
  `requestRefund` appends a note beginning "Refund requested by customer:" with the reason. The
  merchant order page surfaces it and the merchant's `refundOrder` action settles it. One request
  per order; refunded orders cannot request again.
- **Reorder** adds every still-published line to the cart (falling back to the first variant if the
  ordered pot size is gone) and redirects to `/cart`; it fails softly when nothing is available.
- **Profile** edits name and phone; email is read-only because it is the sign-in identity.
- **Addresses** can be added, removed, and made default from the profile; the first address a
  user saves becomes the default. Address inputs got `account-address-{field}` test ids
  (`TESTIDS.md`).

## Milestone 5: admin

- **Merchant guard in the layout.** `requireMerchant()` (`lib/auth/merchant.ts`) runs in the
  `(admin)` layout and every admin page, on top of `proxy.ts`, and loads the store fresh from
  the data layer. Actions use `currentMerchant()` which returns null instead of redirecting.
- **Flags.** `lib/flags.config.ts` holds `FLAGS` and the in-memory flag table with a
  `contextEvaluator` that turns `merchant-analytics` on when `plan === "pro"`. `lib/flags.ts`
  configures the web SDK; `lib/flags.server.ts` the server SDK. `FlagsProvider` registers the
  provider during the first client render with the store's plan as context, and wraps
  `OpenFeatureProvider` with suspense off so the nav never suspends. The analytics nav link uses
  `useBooleanFlagValue`; the analytics page uses the server SDK and renders an upsell when off.
- **Dashboard KPIs** cover the trailing 30 days versus the 30 before. Conversion has no session
  data behind it, so it is checkout conversion: orders ÷ (orders + carts still holding the
  store's products). The tile says so.
- **Product form.** One form, two Server Actions: `saveProduct` keeps a published product
  published (its button reads "Save changes") and otherwise saves a draft; `publishProduct`
  saves and publishes. Both redirect to the edit page with `?saved=1` / `?published=1`.
  `archiveProduct` is a separate form in the sidebar. Variants are shown but not edited; new
  products start without variants and use the category card art.
- **Prices in the form are dollars** (`24.50`) and stored as cents.
- **Orders list filters** live in the URL (`?status=&from=&to=`) and are parsed leniently by
  `lib/admin/order-filters.ts`; the CSV export route handler reads the same query string so the
  download matches the table. Dates are inclusive UTC days.
- **Order status transitions.** Fulfill is allowed from `placed` or `paid` and stamps
  `fulfilledAt` plus an optional tracking number; refund is allowed from any status but
  `refunded`. Customer refund requests (notes) are called out above the order.
- **Customers** are derived, not stored: shopper users and guest emails joined to the store's
  orders. Guest customer ids are `guest-<base64url email>` so the detail route works for them.
- **Promos.** Codes are unique across stores (the storefront looks codes up globally). Percent
  promos store the percentage, fixed promos store cents, free shipping stores 0. The list toggle
  flips `isActive`; the detail form handles everything else and `new` is a valid id.
- **Settings.** Four sections under `/admin/settings/[section]`; `/admin/settings` redirects to
  `store`. The slug is shown read-only so storefront links stay stable. Invites, plan changes, and
  payout edits are owner-only (SPEC §15 allows owner vs staff); staff see disabled controls.
  Payouts keep only the last four digits of the account number.
- **Analytics** renders a CSS bar chart of daily revenue, top products, and median fulfillment
  time for a 7 / 30 / 90 day range chosen with `analytics-date-range`.

## Milestone 6: chat

- **Transport.** `POST /api/chat` streams plain text (`text/plain`, chunked) and returns the
  conversation id and the assistant message id in `x-conversation-id` / `x-message-id` response
  headers before the first byte, so the client can attach ratings to the stored message. The
  reply is persisted onto the conversation when the stream closes.
- **Provider.** `lib/chat/provider.ts` exposes one `ChatProvider` interface with two
  implementations. With `ANTHROPIC_API_KEY` set it uses `@anthropic-ai/sdk`'s beta tool runner
  (`claude-opus-5-5`, effort `low`, streaming, Zod-typed tools with eager input streaming) and
  stops on `refusal` or a truncated tool call. Otherwise the scripted provider picks a reply by
  keyword, fills it with real catalog or sales data through the same tool functions, and emits it
  a few words at a time to look like a token stream.
- **Tools.** `search_catalog`, `get_product`, and `summarize_store_sales` are plain async
  functions in `lib/chat/tools.ts` with Zod input schemas; the Claude provider wraps them with
  `betaZodTool`, the scripted provider calls them directly. The merchant tool only sees the
  signed-in merchant's store; the merchant persona is rejected (403) for anyone else.
- **Persona from layout.** `StorefrontChrome` mounts `<ChatPanel persona="shopper" />`, the admin
  layout mounts `<ChatPanel persona="merchant" />`; both sit inside the `AssistantProvider` that
  `assistant-toggle`, `admin-ask-assistant`, and `/help` drive.
- **Conversation ownership.** Signed-in users' conversations carry `userId` (and `storeId` for
  merchants); anonymous conversations have neither and can be continued by anyone holding the id.
  Ratings on a conversation with a `userId` require that user. One rating per message; a new
  rating replaces the old one.
- **Retry** re-sends the history up to the failed or disliked assistant reply, dropping it.
- **Links.** The panel turns bare `/products/{slug}` paths in replies into links; the system prompt
  asks the model for that form instead of Markdown.

## Milestone 7: analytics wrapper

- **Shape.** `lib/analytics.ts` exports `analytics.track(event, properties)` and
  `analytics.page(name?, properties)`. Both no-op unless `NEXT_PUBLIC_ANALYTICS_WRITE_KEY` is set.
  No third-party SDK is installed.
- **Delivery.** With a key, events are sent as JSON (`writeKey`, `type`, `event`, `properties`,
  `timestamp`, `context`) to `NEXT_PUBLIC_ANALYTICS_ENDPOINT` via `sendBeacon` in the browser or
  `fetch` on the server. That endpoint variable is an addition to SPEC §12's env list; it is
  optional, and when it is absent events are queued on `globalThis` and logged at debug level.
- **Call sites, and only these three.** "Products Searched" fires in the header search form on
  submit; "Promo Applied" fires on the client after `applyPromo` succeeds from the cart form
  (`source: "cart"`) and from the promo landing (`source: "link"`); "Orders Exported" fires in
  the CSV route handler with the filters and row count. `analytics.page()` exists but nothing
  calls it, matching SPEC §5's "the team never got around to the rest".

## Milestone 8: traffic bot

- **Layout.** `e2e/traffic/` is its own Playwright config (`pnpm traffic`): `config.ts` holds
  the SPEC §12 percentages, viewports, entry points, and pacing; `plan.ts` turns a seed into a
  deterministic list of sessions; `scenarios/` drive the browser; `traffic.spec.ts` registers one
  Playwright test per session so sessions are independent and failures are reported per session.
- **Determinism.** A run seed (`TRAFFIC_SEED`, defaulting to the UTC hour plus the Actions run id)
  feeds a small PRNG. The config fixes the seed into `process.env` once so every worker builds the
  same plan. Each session gets its own sub-seed so a failing session can be replayed.
- **`sessions` is a multiplier** as SPEC §12 says: the workflow input (and the `SESSIONS` env var
  locally) scales the 10–16 shopper and 3–5 merchant ranges. `SESSIONS=3` locally therefore runs
  roughly 40–60 sessions.
- **Visitor rotation.** Shoppers rotate as a 15-wide window over the 40-person pool that slides
  six places a day, so everyone appears within a week. Merchant sessions walk a fixed store cycle
  with Fernhollow (pro) twice per five sessions; within a store the owner and two staff alternate
  by run number. Beyond the seeded shoppers, purchases use a fixed list of guest emails.
- **Every tenth run** (`GITHUB_RUN_NUMBER % 10 === 0`, or `TRAFFIC_RUN_NUMBER` locally) one
  merchant session also exports orders, edits a promo's end date, or visits billing, rotating.
- **Bot marker.** Each context sets the `lw_source=bot` cookie before navigating, so
  `placeOrder`, `saveProduct`, and the chat route stamp `source: "bot"`.
- **Traces only on failure.** Contexts are created by hand (for viewport and cookie), so tracing
  is started per session and the trace is kept and attached only when the session throws. The
  workflow uploads `test-results/traffic` only when the job fails.
- **Nightly archive.** `GET /api/jobs/archive-bot-products` archives bot products older than
  seven days; Vercel Cron (`vercel.json`, 03:15 UTC) calls it with `Authorization: Bearer
$CRON_SECRET`. Without the secret the route only works outside production. `CRON_SECRET` is an
  addition to SPEC §12's env list. Bot orders and conversations need no job: the KV adapter gives
  them a 14-day TTL.
- **Schedule.** `0 6-23/2 * * 1-5` and `0 6-23/4 * * 0,6`, with a `concurrency` group so runs
  do not overlap. Nothing blocks third-party scripts.

## Milestone 9: deploy readiness

- **KV adapter is an overlay, not a copy.** `lib/db/kv.ts` never writes the seed to Redis. Reads
  merge the committed JSON with `lw:{collection}:{id}` records (runtime wins) and skip ids in
  `lw:{collection}:removed`. This keeps "seed data does not expire" trivially true, needs no
  import step, and makes a fresh Upstash database usable on the first request. Bot records are
  written with `EX` so Redis expires them; expired ids are pruned from the id set lazily on list.
- **Adapter choice** happens once per process in `lib/db/index.ts`: KV when both
  `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, memory otherwise. The KV adapter is covered by
  unit tests against a fake client; it was not exercised against a real Upstash database here.
- **`vercel.json`** carries only the nightly cron. Next.js needs no other Vercel configuration.
- **README** documents local setup, every environment variable (including the two added beyond
  SPEC §12: `NEXT_PUBLIC_ANALYTICS_ENDPOINT` and `CRON_SECRET`), deploy steps, and the bot.

## Assistant conversation traffic

- **Why.** The scenario mix gave the assistants one or two single-turn chats per run from three
  fixed prompts. Conversation analytics needs volume, multi-turn chats, and asks the assistants
  cannot serve, so the bot now holds about thirty conversations a weekday (SPEC §12 row
  "Conversations").
- **Intent bank.** `e2e/traffic/conversations.ts` lists named intents per persona, each tagged
  `supported`, `unsupported`, or `off-topic`, with openers and follow-ups. Unsupported intents are
  real requests the assistants have no tool for (order status, refunds, delivery dates, creating
  promos, editing prices, emailing customers, forecasting, integrations). An intent's first opener
  matches its suggestion chip when it has one, which a unit test enforces.
- **Shared driver.** `scenarios/chat.ts` runs a conversation in an open panel for either persona.
  It detects a finished reply by the newest `chat-rate-up-{id}` control and the input re-enabling,
  waits up to 90 s per reply for tool-calling model answers, and reads in proportion to reply
  length. The Playwright timeout for traffic rose from 240 s to 420 s for four-turn chats.
- **Extra sessions, not a reweighted mix.** Conversations come from 1–2 dedicated chat sessions per
  run on top of the existing scenario weights, so the shopping and merchant mix is unchanged.
- **Follow-through.** A shopper follows a recommended product link toward purchase only after an
  in-scope conversation.

## Anthropic workspace header

- **`ANTHROPIC_WORKSPACE_ID`** (optional, beyond SPEC §12's env list). Keys that are not scoped to
  a workspace are rejected unless each request carries `anthropic-workspace-id`. The SDK has no
  option for it, so `createAnthropicClient` sends it as a default header when the variable is set.

## Conversations workflow

- **Same project, different plan.** `.github/workflows/conversations.yml` runs `pnpm traffic` with
  `TRAFFIC_MODE=conversations`, and `traffic.spec.ts` builds `buildConversationPlan` instead of
  `buildPlan`. Sessions, pacing, the chat driver, and traces are shared with the traffic bot.
- **Coverage by rotation.** Each run's topics are the next slice of each persona's intent bank,
  indexed by the workflow's run number, so every intent comes up within two to four runs. The
  bank is interleaved by scope so any four consecutive topics include an unsupported ask.
- **Schedule.** 09:30, 14:30, and 19:30 UTC on weekdays and 15:30 UTC on weekends, offset from the
  traffic runs on the hour, with its own concurrency group. Eight conversations per run adds
  about 24 a weekday on top of the traffic bot's 30.
- **Help entry.** A share of conversation-run shoppers start on `/help`, where the panel opens on
  arrival; the chat step only clicks `assistant-toggle` when the panel is closed.
