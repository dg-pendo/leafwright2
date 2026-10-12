"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { clearCart, getCart, priceStoredCart } from "@/lib/cart/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import type { Order, OrderLine } from "@/lib/db/schema";
import { rememberGuestOrders } from "@/lib/orders/access";
import { fieldErrors, formValue, PlaceOrderSchema, saveAddress } from "@/lib/orders/checkout";
import { getRecordSource } from "@/lib/request-source";

export interface CheckoutState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
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
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const session = await auth();
  const cart = await getCart();
  const { totals, promo } = await priceStoredCart(cart, input.shippingMethod);
  if (totals.itemCount === 0) return { error: "Your cart is empty." };

  for (const group of totals.groups) {
    for (const { product, variant, line } of group.lines) {
      const available = variant ? variant.inventory : product.inventory;
      if (available < line.quantity) {
        return { error: `Only ${available} of ${product.name} left in stock.` };
      }
    }
  }

  const source = await getRecordSource();
  const placedAt = new Date().toISOString();
  const customerId = session?.user?.id;
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
    await saveAddress(customerId, { ...input, label: "Home" });
  }

  await clearCart(cart);
  if (!customerId) await rememberGuestOrders(created.map((order) => order.number));

  revalidatePath("/", "layout");
  redirect(`/orders/${created[0].number}/confirmation`);
}
