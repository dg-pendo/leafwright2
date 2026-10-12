/** Traffic bot tuning, mirroring SPEC §12. Percentages are weights that sum to 100. */

export const SHOPPER_SESSIONS = { min: 10, max: 16 } as const;
export const MERCHANT_SESSIONS = { min: 3, max: 5 } as const;
/**
 * Extra sessions per run that exist to talk to an assistant, on top of the chat share of the
 * scenario mix, so the assistants see about thirty conversations a day.
 */
export const CONVERSATION_SESSIONS = { min: 1, max: 2 } as const;
/** Share of those conversation sessions held with the merchant assistant. */
export const CONVERSATION_MERCHANT_SHARE = 0.4;
/**
 * The conversations-only run (`TRAFFIC_MODE=conversations`): every session talks to an
 * assistant, split evenly between the two, walking through every intent across runs.
 */
export const CONVERSATION_RUN = { sessions: 8, merchantShare: 0.5 } as const;

/** Roughly this many shoppers are active on any given day; the pool rotates through all 40 weekly. */
export const ACTIVE_SHOPPERS_PER_DAY = 15;
export const SHOPPER_POOL_SIZE = 40;

export const ENTRY_POINTS = [
  { value: "home", weight: 40 },
  { value: "product", weight: 30 },
  { value: "promo", weight: 15 },
  { value: "store", weight: 15 },
] as const;
/** Where conversation-run shoppers start; `/help` opens the assistant on arrival. */
export const CONVERSATION_ENTRY_POINTS = [
  { value: "help", weight: 30 },
  { value: "home", weight: 30 },
  { value: "product", weight: 30 },
  { value: "store", weight: 10 },
] as const;
export type EntryPoint =
  (typeof ENTRY_POINTS)[number]["value"] | (typeof CONVERSATION_ENTRY_POINTS)[number]["value"];

export const VIEWPORTS = [
  { value: "desktop", weight: 65, size: { width: 1366, height: 860 } },
  { value: "tablet", weight: 20, size: { width: 834, height: 1112 } },
  { value: "mobile", weight: 15, size: { width: 390, height: 844 } },
] as const;
export type ViewportKind = (typeof VIEWPORTS)[number]["value"];

export const SHOPPER_SCENARIOS = [
  { value: "browse", weight: 35 },
  { value: "add-to-cart-and-leave", weight: 20 },
  { value: "abandon-at-payment", weight: 15 },
  { value: "purchase", weight: 20 },
  { value: "chat", weight: 10 },
] as const;
export type ShopperScenario = (typeof SHOPPER_SCENARIOS)[number]["value"];

export const MERCHANT_SCENARIOS = [
  { value: "dashboard-check", weight: 30 },
  { value: "fulfill-orders", weight: 30 },
  { value: "create-and-publish-product", weight: 15 },
  { value: "draft-only", weight: 10 },
  { value: "chat", weight: 15 },
] as const;
export type MerchantScenario = (typeof MERCHANT_SCENARIOS)[number]["value"];

/** Every tenth run one merchant session also does one of these. */
export const TENTH_RUN_EXTRAS = ["export-orders", "edit-promo", "visit-billing"] as const;
export type MerchantExtra = (typeof TENTH_RUN_EXTRAS)[number];

/** Store slugs in rotation order; Fernhollow (pro) appears twice so the flagged analytics page gets traffic. */
export const STORE_ROTATION = [
  "fernhollow-nursery",
  "dry-creek-succulents",
  "fernhollow-nursery",
  "kiln-and-vine",
  "moss-lane",
] as const;

/**
 * Share of shopper sessions that sign in at the start; the rest stay anonymous and, if they buy,
 * check out as guests, which lands purchases at roughly half guest.
 */
export const SIGNED_IN_SHOPPER_SHARE = 0.5;
/** Share of chat sessions that go on to buy something. */
export const CHAT_THEN_PURCHASE_SHARE = 0.5;
/** Share of product-form sessions that abandon before saving. */
export const PRODUCT_FORM_ABANDON_SHARE = 0.2;
/** Share of opened orders a merchant actually fulfills. */
export const FULFILL_SHARE = 0.75;
/** Share of sign-in prompts a shopper bounces from. */
export const SIGN_IN_BOUNCE_SHARE = 0.08;

export const PACING = {
  dwellMs: { min: 1500, max: 6000 },
  typingDelayMs: { min: 55, max: 140 },
  backNavigationShare: 0.15,
} as const;

export const CHAT = {
  /** A model reply with tool calls can take a while; give it room before calling the turn failed. */
  replyTimeoutMs: 90_000,
  readMsPerChar: 25,
  maxReadMs: 12_000,
  /** Share of replies that get retried when the answer is not what the person wanted. */
  retryShare: 0.1,
  /** Share of replies rated: intermediate turns, then the final turn. */
  rateEachShare: 0.35,
  rateLastShare: 0.7,
  /** Chance a rating is thumbs up, by what the turn asked for. */
  thumbsUpShare: { supported: 0.8, unsupported: 0.25, "off-topic": 0.5 },
} as const;

export const DEFAULT_PASSWORD = "leafwright-demo";
