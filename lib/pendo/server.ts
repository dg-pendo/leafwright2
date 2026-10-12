import { after } from "next/server";
import type { Session } from "next-auth";
import type { MerchantContext } from "@/lib/auth/merchant";
import {
  cleanProperties,
  type CleanTrackProperties,
  type TrackEventName,
  type TrackProperties,
} from "./events";

const TRACK_URL = "https://data.pendo.io/data/track";
const SEND_TIMEOUT_MS = 5_000;

/** Who an event is about: a person, and for merchants the store they work for. */
export interface TrackActor {
  visitorId: string;
  accountId?: string;
}

export interface TrackPayload {
  type: "track";
  event: TrackEventName;
  visitorId: string;
  accountId?: string;
  timestamp: number;
  properties: CleanTrackProperties;
}

export function merchantActor({ user, store }: MerchantContext): TrackActor {
  return { visitorId: user.id, accountId: store.id };
}

/** A signed-in user, with their store (merchants only) as the account. */
export function userActor(session: Session): TrackActor {
  return { visitorId: session.user.id, accountId: session.store?.id };
}

/**
 * Shoppers can act without signing in. They have no user id then, so the id of their cart (kept
 * in a signed cookie until checkout) stands in for them.
 */
export function shopperActor(session: Session | null, cartId: string): TrackActor {
  return session?.user ? userActor(session) : { visitorId: cartId };
}

async function send(payload: TrackPayload, secret: string): Promise<void> {
  try {
    const response = await fetch(TRACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`Track event ${payload.event} was rejected (${response.status})`);
    }
  } catch (error) {
    console.error(`Track event ${payload.event} could not be sent`, error);
  }
}

/**
 * Records a track event from server code. It is sent after the response, so it does not slow the
 * action down and still goes out when the action ends in `redirect()`. Failures are logged and
 * never reach the user. Does nothing unless PENDO_TRACK_EVENT_SECRET is set.
 */
export function trackServerEvent(
  event: TrackEventName,
  actor: TrackActor,
  properties: TrackProperties = {},
): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) return;
  const payload: TrackPayload = {
    type: "track",
    event,
    visitorId: actor.visitorId,
    accountId: actor.accountId,
    timestamp: Date.now(),
    properties: cleanProperties(properties),
  };
  try {
    after(() => send(payload, secret));
  } catch {
    // Outside a request (scripts, tests) there is no response to wait for.
    void send(payload, secret);
  }
}
