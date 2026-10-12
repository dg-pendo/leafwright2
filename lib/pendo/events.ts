/**
 * Track events the app records. Reports match on these names exactly, so never reword or re-case
 * one; add a new name instead.
 */
export type TrackEventName =
  // Storefront
  | "products_searched"
  | "product_added_to_cart"
  | "product_removed_from_cart"
  | "promo_applied"
  | "promo_code_rejected"
  | "checkout_started"
  | "checkout_failed"
  | "order_placed"
  | "store_follow_toggled"
  | "user_signed_in"
  | "sign_in_failed"
  // Account
  | "address_saved"
  | "refund_requested"
  | "order_reordered"
  // Merchant admin
  | "orders_exported"
  | "product_saved"
  | "product_published"
  | "product_archived"
  | "order_fulfilled"
  | "order_refunded"
  | "order_note_added"
  | "promo_saved"
  | "promo_toggled"
  | "team_member_invited"
  | "plan_changed"
  | "store_details_updated"
  | "payout_account_updated"
  // Assistant
  | "assistant_conversation_started"
  | "assistant_message_sent"
  | "assistant_response_rated"
  | "assistant_response_retried"
  | "assistant_response_failed";

export type TrackPropertyValue = string | number | boolean | null | readonly string[];

/** Event properties. Undefined values are left out of the event. */
export type TrackProperties = Record<string, TrackPropertyValue | undefined>;

export type CleanTrackProperties = Record<string, string | number | boolean | null | string[]>;

/** Events carry at most 512 bytes of properties, so long strings and lists are cut short. */
const MAX_STRING_LENGTH = 100;
const MAX_LIST_LENGTH = 20;

function clip(value: string): string {
  return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
}

export function cleanProperties(properties: TrackProperties): CleanTrackProperties {
  const clean: CleanTrackProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    if (typeof value === "string") clean[key] = clip(value);
    else if (typeof value === "object" && value !== null)
      clean[key] = value.slice(0, MAX_LIST_LENGTH).map(clip);
    else clean[key] = value;
  }
  return clean;
}
