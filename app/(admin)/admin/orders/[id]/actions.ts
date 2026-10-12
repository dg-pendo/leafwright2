"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMerchant } from "@/lib/auth/merchant";
import { daysSince, hoursSince } from "@/lib/dates";
import { db } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { formValue } from "@/lib/orders/checkout";
import { hasRefundRequest } from "@/lib/orders/history";
import { merchantActor, trackServerEvent } from "@/lib/pendo/server";

export interface OrderAdminState {
  error?: string;
  message?: string;
}

async function storeOrder(orderId: string | undefined) {
  const merchant = await currentMerchant();
  if (!merchant || !orderId) return null;
  const order = await db.orders.getById(orderId);
  if (!order || order.storeId !== merchant.store.id) return null;
  return { merchant, order };
}

function refresh(orderId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

const FulfillSchema = z.object({
  orderId: z.string().min(1),
  trackingNumber: z.string().trim().max(64).optional(),
});

export async function fulfillOrder(
  _prev: OrderAdminState,
  formData: FormData,
): Promise<OrderAdminState> {
  const parsed = FulfillSchema.safeParse({
    orderId: formValue(formData, "orderId"),
    trackingNumber: formValue(formData, "trackingNumber"),
  });
  if (!parsed.success) return { error: "Check the tracking number." };
  const found = await storeOrder(parsed.data.orderId);
  if (!found) return { error: "That order isn't in your store." };
  if (found.order.status !== "placed" && found.order.status !== "paid") {
    return { error: "Only placed or paid orders can be fulfilled." };
  }
  const trackingNumber = parsed.data.trackingNumber || found.order.trackingNumber;
  await db.orders.update(found.order.id, {
    status: "fulfilled",
    fulfilledAt: new Date().toISOString(),
    trackingNumber,
  });
  trackServerEvent("order_fulfilled", merchantActor(found.merchant), {
    orderId: found.order.id,
    orderNumber: found.order.number,
    storeId: found.order.storeId,
    previousStatus: found.order.status,
    hasTrackingNumber: Boolean(trackingNumber),
    hoursToFulfill: hoursSince(found.order.placedAt),
    orderTotal: found.order.total,
    itemCount: found.order.lines.reduce((sum, line) => sum + line.quantity, 0),
  });
  refresh(found.order.id);
  return { message: "Marked as fulfilled." };
}

export async function refundOrder(
  _prev: OrderAdminState,
  formData: FormData,
): Promise<OrderAdminState> {
  const found = await storeOrder(formValue(formData, "orderId"));
  if (!found) return { error: "That order isn't in your store." };
  if (found.order.status === "refunded") return { error: "This order was already refunded." };
  await db.orders.update(found.order.id, { status: "refunded" });
  trackServerEvent("order_refunded", merchantActor(found.merchant), {
    orderId: found.order.id,
    orderNumber: found.order.number,
    storeId: found.order.storeId,
    previousStatus: found.order.status,
    refundAmount: found.order.total,
    hadCustomerRequest: hasRefundRequest(found.order),
    daysSincePlaced: daysSince(found.order.placedAt),
  });
  refresh(found.order.id);
  return { message: "Order refunded." };
}

const NoteSchema = z.object({
  orderId: z.string().min(1),
  body: z.string().trim().min(1, "Write a note first.").max(1000),
});

export async function addOrderNote(
  _prev: OrderAdminState,
  formData: FormData,
): Promise<OrderAdminState> {
  const parsed = NoteSchema.safeParse({
    orderId: formValue(formData, "orderId"),
    body: formValue(formData, "body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Write a note first." };
  const found = await storeOrder(parsed.data.orderId);
  if (!found) return { error: "That order isn't in your store." };
  await db.orders.update(found.order.id, {
    notes: [
      ...found.order.notes,
      {
        id: newId("note"),
        authorId: found.merchant.user.id,
        body: parsed.data.body,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  trackServerEvent("order_note_added", merchantActor(found.merchant), {
    orderId: found.order.id,
    storeId: found.order.storeId,
    orderStatus: found.order.status,
    noteLength: parsed.data.body.length,
    hasRefundRequest: hasRefundRequest(found.order),
    authorRole: found.merchant.user.role,
  });
  refresh(found.order.id);
  return { message: "Note added." };
}
