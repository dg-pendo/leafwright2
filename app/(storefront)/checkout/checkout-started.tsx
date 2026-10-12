"use client";

import { useEffect } from "react";
import { z } from "zod";
import { pendo } from "@/lib/pendo/client";

const STORAGE_KEY = "leafwright:checkout-started";
const REMEMBERED = 10;

const StartedCheckoutsSchema = z.array(
  z.object({ cartId: z.string(), productIds: z.array(z.string()), isGuest: z.boolean() }),
);
type StartedCheckout = z.infer<typeof StartedCheckoutsSchema>[number];

/** Copy kept for when session storage is unavailable, so in-app navigation is still covered. */
let inMemory: StartedCheckout[] = [];

function readStarted(): StartedCheckout[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return inMemory;
    const parsed = StartedCheckoutsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : inMemory;
  } catch {
    return inMemory;
  }
}

function writeStarted(started: StartedCheckout[]): void {
  inMemory = started;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(started));
  } catch {
    // Storage can be full or blocked; the in-memory copy still covers this page session.
  }
}

/**
 * Remembers this checkout for the tab and says whether it is new. A cart seen before is a reload
 * or a return to the page. Signing in from checkout merges the guest cart into the account's cart
 * under a new id, so a signed-in cart holding everything from a guest checkout continues it.
 */
function recordCheckout(current: StartedCheckout): boolean {
  const started = readStarted();
  const seen = started.some((entry) => entry.cartId === current.cartId);
  const resumed = current.isGuest
    ? undefined
    : started.find(
        (entry) => entry.isGuest && entry.productIds.every((id) => current.productIds.includes(id)),
      );
  writeStarted(
    [
      ...started.filter((entry) => entry.cartId !== current.cartId && entry !== resumed),
      current,
    ].slice(-REMEMBERED),
  );
  return !seen && !resumed;
}

export function CheckoutStarted({
  cartId,
  productIds,
  itemCount,
  subtotal,
  discount,
  total,
  storeCount,
  promoCode,
  isGuest,
  hasSavedAddress,
}: {
  cartId: string;
  productIds: string[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  storeCount: number;
  promoCode: string | null;
  isGuest: boolean;
  hasSavedAddress: boolean;
}) {
  useEffect(() => {
    if (!recordCheckout({ cartId, productIds, isGuest })) return;
    pendo.track("checkout_started", {
      cartId,
      itemCount,
      subtotal,
      discount,
      total,
      storeCount,
      promoCode,
      isGuest,
      hasSavedAddress,
    });
  }, [
    cartId,
    productIds,
    itemCount,
    subtotal,
    discount,
    total,
    storeCount,
    promoCode,
    isGuest,
    hasSavedAddress,
  ]);

  return null;
}
