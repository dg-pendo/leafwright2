"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { cartItemCount, clearCart, getCart, priceStoredCart } from "@/lib/cart/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { ShippingMethodSchema, type Cart, type Order, type OrderLine } from "@/lib/db/schema";
import { rememberGuestOrders } from "@/lib/orders/access";
import { fieldErrors, formValue, PlaceOrderSchema, saveAddress } from "@/lib/orders/checkout";
import { shopperActor, trackServerEvent } from "@/lib/pendo/server";
import { getRecordSource } from "@/lib/request-source";

export interface CheckoutState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

interface CheckoutFailure {
  errorType: "validation" | "empty_cart" | "out_of_stock";
  invalidFields?: string[];
  productId?: string;
  availableQuantity?: number;
}

/** Records why an order was not placed: field names only, never what was typed. */
function trackCheckoutFailure(
  session: Session | null,
  cart: Cart,
  shippingMethod: string | undefined,
  failure: CheckoutFailure,
): void {
  const method = ShippingMethodSchema.safeParse(shippingMethod);
  trackServerEvent("checkout_failed", shopperActor(session, cart.id), {
    errorType: failure.errorType,
    invalidFields: failure.invalidFields ?? null,
    productId: failure.productId ?? null,
    availableQuantity: failure.availableQuantity ?? null,
    itemCount: cartItemCount(cart),
    isGuest: !session?.user,
    shippingMethod: method.success ? method.data : null,
  });
}

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const session = await auth();
  const cart = await getCart();
  const parsed = PlaceOrderSchema.safeParse({
    email: formValue(formData, "email"),
    name: formValue(formData, "name"),
    address1: formValue(formData, "address1"),
    address2: formValue(formData, "address2"),
    city: formValue(formData, "city"),
    region: formValue(formData, "region"),
    postal: formValue(formData, "postal"),
    phone: formValue(formData, "phone"),
    shippingMethod: formValue(formData, "shippingMethod") ?? "standard",
    saveAddress: formData.get("saveAddress") === "on",
    cardNumber: formValue(formData, "cardNumber"),
    cardExpiry: formValue(formData, "cardExpiry"),
    cardCvc: formValue(formData, "cardCvc"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    trackCheckoutFailure(session, cart, formValue(formData, "shippingMethod") ?? "standard", {
      errorType: "validation",
      invalidFields: Object.keys(errors),
    });
    return { error: "Check the highlighted fields.", fieldErrors: errors };
  }
  const input = parsed.data;

  const { totals, promo } = await priceStoredCart(cart, input.shippingMethod);
  if (totals.itemCount === 0) {
    trackCheckoutFailure(session, cart, input.shippingMethod, { errorType: "empty_cart" });
    return { error: "Your cart is empty." };
  }

  for (const group of totals.groups) {
    for (const { product, variant, line } of group.lines) {
      const available = variant ? variant.inventory : product.inventory;
      if (available < line.quantity) {
        trackCheckoutFailure(session, cart, input.shippingMethod, {
          errorType: "out_of_stock",
          productId: product.id,
          availableQuantity: available,
        });
        return { error: `Only ${available} of ${product.name} left in stock.` };
      }
    }
  }

  const source = await getRecordSource();
  const placedAt = new Date().toISOString();
  const customerId = session?.user?.id;
  const actor = shopperActor(session, cart.id);
  const created: Order[] = [];

  for (const group of totals.groups) {
    const lines: OrderLine[] = group.lines.map(({ product, variant, line, unitPrice }) => ({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantId: variant?.id,
      variantLabel: variant?.label,
      unitPrice,
      quantity: line.quantity,
      image: product.images[0],
    }));
    const order = await db.orders.create({
      id: newId("order"),
      number: await db.orders.nextNumber(),
      storeId: group.storeId,
      customerId,
      guestEmail: customerId ? undefined : input.email,
      lines,
      subtotal: group.subtotal,
      discount: group.discount,
      shipping: group.shipping,
      tax: group.tax,
      total: group.total,
      status: "paid",
      shippingAddress: {
        name: input.name,
        phone: input.phone || undefined,
        line1: input.address1,
        line2: input.address2 || undefined,
        city: input.city,
        region: input.region,
        postalCode: input.postal,
        country: "US",
      },
      shippingMethod: input.shippingMethod,
      promoCode: group.promo?.code,
      notes: [],
      source,
      placedAt,
    });
    created.push(order);

    for (const { product, variant, line } of group.lines) {
      await db.products.update(product.id, {
        inventory: Math.max(0, product.inventory - line.quantity),
        variants: product.variants.map((item) =>
          item.id === variant?.id
            ? { ...item, inventory: Math.max(0, item.inventory - line.quantity) }
            : item,
        ),
      });
    }
  }

  if (promo && created.some((order) => order.promoCode === promo.code)) {
    await db.promos.update(promo.id, { usageCount: promo.usageCount + 1 });
  }

  if (customerId && input.saveAddress) {
    const saved = await saveAddress(customerId, { ...input, label: "Home" });
    trackServerEvent("address_saved", actor, {
      source: "checkout",
      label: saved.address.label,
      isDefault: saved.address.isDefault,
      isDuplicate: !saved.created,
      addressCount: saved.addressCount,
    });
  }

  await clearCart(cart);
  if (!customerId) await rememberGuestOrders(created.map((order) => order.number));

  // Sent from here rather than the confirmation page so reloading that page cannot count twice.
  trackServerEvent("order_placed", actor, {
    orderNumbers: created.map((order) => order.number),
    orderCount: created.length,
    storeIds: created.map((order) => order.storeId),
    itemCount: totals.itemCount,
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: totals.shipping,
    tax: totals.tax,
    total: totals.total,
    shippingMethod: input.shippingMethod,
    promoCode: created.find((order) => order.promoCode)?.promoCode ?? null,
    isGuest: !customerId,
    savedAddress: Boolean(customerId && input.saveAddress),
    recordSource: source,
  });

  revalidatePath("/", "layout");
  redirect(`/orders/${created[0].number}/confirmation`);
}
