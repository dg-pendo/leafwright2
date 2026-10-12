import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";
import products from "../../seed/products.json";
import promos from "../../seed/promos.json";
import { DEFAULT_PASSWORD, SIGN_IN_BOUNCE_SHARE, VIEWPORTS } from "./config";
import { dwell, typeInto } from "./pacing";
import type { Session, Visitor } from "./plan";
import { Rng } from "./rng";

export const BOT_SOURCE_COOKIE = "lw_source";

export interface SessionRun {
  context: BrowserContext;
  page: Page;
  rng: Rng;
  log: (message: string) => void;
}

export function password(): string {
  return process.env.DEMO_PASSWORD || DEFAULT_PASSWORD;
}

export const publishedProducts = products.filter((product) => product.status === "published");
export const activePromoCodes = promos.filter((promo) => promo.isActive).map((promo) => promo.code);

/** A fresh browser context per session, sized by the plan and marked as automated traffic. */
export async function openSession(
  browser: Browser,
  session: Session,
  baseURL: string,
): Promise<SessionRun> {
  const viewport =
    VIEWPORTS.find((candidate) => candidate.value === session.viewport) ?? VIEWPORTS[0];
  const context = await browser.newContext({
    // Viewports are sizes only; device emulation changes hit-testing in ways real browsers do not.
    viewport: viewport.size,
    locale: "en-US",
  });
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: BOT_SOURCE_COOKIE,
      value: "bot",
      domain: url.hostname,
      path: "/",
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const rng = new Rng(session.seed);
  const log = (message: string) => console.log(`[${session.id}] ${message}`);
  return { context, page, rng, log };
}

/** Keeps the trace only when the session failed. */
export async function closeSession(
  run: SessionRun,
  testInfo: TestInfo,
  failed: boolean,
): Promise<void> {
  if (failed) {
    const path = testInfo.outputPath("trace.zip");
    await run.context.tracing.stop({ path });
    await testInfo.attach("trace", { path, contentType: "application/zip" });
  } else {
    await run.context.tracing.stop();
  }
  await run.context.close();
}

/**
 * Signs in through the real form. Returns false when the session "bounces" at the prompt,
 * which a small share of shoppers do.
 */
export async function signIn(
  run: SessionRun,
  visitor: Visitor,
  callbackUrl: string,
  allowBounce = true,
): Promise<boolean> {
  const { page, rng, log } = run;
  await page.goto(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await dwell(page, rng, 0.5);
  if (allowBounce && rng.chance(SIGN_IN_BOUNCE_SHARE)) {
    log("bounced at the sign-in prompt");
    return false;
  }
  await typeInto(page.getByTestId("signin-email"), rng, visitor.email);
  await typeInto(page.getByTestId("signin-password"), rng, password());
  await page.getByTestId("signin-submit").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 30_000 });
  log(`signed in as ${visitor.email}`);
  return true;
}

export function randomProduct(rng: Rng) {
  return rng.pick(publishedProducts);
}

export const GUEST_EMAILS = [
  "june.okafor@example.com",
  "theo.lindqvist@example.com",
  "priya.raman@example.com",
  "marco.benedetti@example.com",
  "hana.sato@example.com",
  "lucas.ferreira@example.com",
];

export const ADDRESSES = [
  {
    name: "June Okafor",
    address1: "118 Alder Street",
    city: "Portland",
    region: "OR",
    postal: "97209",
  },
  {
    name: "Theo Lindqvist",
    address1: "42 Prospect Avenue",
    city: "Tucson",
    region: "AZ",
    postal: "85705",
  },
  {
    name: "Priya Raman",
    address1: "9 Haywood Road",
    city: "Asheville",
    region: "NC",
    postal: "28801",
  },
  {
    name: "Marco Benedetti",
    address1: "77 Church Street",
    city: "Burlington",
    region: "VT",
    postal: "05401",
  },
  { name: "Hana Sato", address1: "310 Pine Court", city: "Boulder", region: "CO", postal: "80302" },
];
