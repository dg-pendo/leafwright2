"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getCart, saveCart } from "@/lib/cart/server";
import { addLine } from "@/lib/commerce/cart";
import { db } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { formValue } from "@/lib/orders/checkout";
import { canRequestRefund, orderBelongsTo, REFUND_REQUEST_PREFIX } from "@/lib/orders/history";

export interface OrderActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function ownedOrder(orderNumber: string | undefined) {
  const session = await auth();
  if (!session?.user || !orderNumber) return null;
  const order = await db.orders.getByNumber(orderNumber);
  if (!order || !orderBelongsTo(order, session.user)) return null;
  return { session, order };
}

/** Puts every still-available line from the order back in the cart and goes there. */
export async function reorder(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const owned = await ownedOrder(formValue(formData, "orderNumber"));
  if (!owned) return { error: "We couldn't find that order." };
  const products = await db.products.getMany(owned.order.lines.map((line) => line.productId));
  const available = new Map(products.filter((p) => p.status === "published").map((p) => [p.id, p]));

  const cart = await getCart();
  let lines = cart.lines;
  let added = 0;
  for (const line of owned.order.lines) {
    const product = available.get(line.productId);
    if (!product) continue;
    const variantId = product.variants.some((v) => v.id === line.variantId)
      ? line.variantId
      : product.variants[0]?.id;
    lines = addLine(lines, product.id, line.quantity, variantId);
    added += 1;
  }
  if (added === 0) return { error: "None of those items are available right now." };
  await saveCart({ ...cart, lines });
  revalidatePath("/", "layout");
  redirect("/cart");
}

const RefundSchema = z.object({
  orderNumber: z.string().min(1),
  reason: z.string().trim().min(3, "Tell the nursery what went wrong.").max(500),
});

export async function requestRefund(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const parsed = RefundSchema.safeParse({
    orderNumber: formValue(formData, "orderNumber"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const owned = await ownedOrder(parsed.data.orderNumber);
  if (!owned) return { error: "We couldn't find that order." };
  if (!canRequestRefund(owned.order))
    return { error: "A refund is already in progress for this order." };

  await db.orders.update(owned.order.id, {
    notes: [
      ...owned.order.notes,
      {
        id: newId("note"),
        authorId: owned.session.user.id,
        body: `${REFUND_REQUEST_PREFIX}: ${parsed.data.reason}`,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  revalidatePath(`/account/orders/${owned.order.number}`);
  return { ok: true, message: "Refund requested. The nursery will follow up by email." };
}
