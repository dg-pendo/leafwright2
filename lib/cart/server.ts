import { cookies } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { mergeCarts, priceCart, type CartTotals } from "@/lib/commerce/cart";
import { evaluatePromo } from "@/lib/commerce/promo";
import { cookieOptions, decodeSigned, encodeSigned } from "@/lib/cookies";
import { db } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import {
  CartLineSchema,
  type Cart,
  type Product,
  type Promo,
  type ShippingMethod,
} from "@/lib/db/schema";

export const CART_COOKIE = "lw_cart";

const CookieCartSchema = z.object({
  id: z.string().min(1),
  lines: z.array(CartLineSchema),
  promoCode: z.string().optional(),
});

function emptyCart(userId?: string): Cart {
  return { id: newId("cart"), userId, lines: [], updatedAt: new Date().toISOString() };
}

async function readCookieCart(): Promise<Cart | undefined> {
  const jar = await cookies();
  const stored = decodeSigned(jar.get(CART_COOKIE)?.value, CookieCartSchema);
  if (!stored) return undefined;
  return { ...stored, updatedAt: new Date().toISOString() };
}

/** The signed-in user's cart, or the anonymous cart from the signed cookie. */
export async function getCart(): Promise<Cart> {
  const session = await auth();
  if (session?.user) {
    return (await db.carts.getByUserId(session.user.id)) ?? emptyCart(session.user.id);
  }
  return (await readCookieCart()) ?? emptyCart();
}

export async function saveCart(cart: Cart): Promise<void> {
  const updated = { ...cart, updatedAt: new Date().toISOString() };
  if (updated.userId) {
    await db.carts.save(updated);
    return;
  }
  const jar = await cookies();
  jar.set(
    CART_COOKIE,
    encodeSigned({ id: updated.id, lines: updated.lines, promoCode: updated.promoCode }),
    cookieOptions,
  );
}

export async function clearCart(cart: Cart): Promise<void> {
  if (cart.userId) {
    await db.carts.remove(cart.id);
    return;
  }
  const jar = await cookies();
  jar.delete(CART_COOKIE);
}

/** Folds the anonymous cookie cart into the user's stored cart and drops the cookie. */
export async function mergeAnonymousCart(userId: string): Promise<void> {
  const anonymous = await readCookieCart();
  if (!anonymous) return;
  const existing = (await db.carts.getByUserId(userId)) ?? emptyCart(userId);
  if (anonymous.lines.length || anonymous.promoCode) {
    await db.carts.save(mergeCarts(anonymous, existing));
  }
  const jar = await cookies();
  jar.delete(CART_COOKIE);
}

export interface PricedCart {
  cart: Cart;
  products: Product[];
  promo?: Promo;
  totals: CartTotals;
}

export async function priceStoredCart(
  cart: Cart,
  shippingMethod: ShippingMethod = "standard",
): Promise<PricedCart> {
  const products = await db.products.getMany(cart.lines.map((line) => line.productId));
  const candidate = cart.promoCode ? await db.promos.getByCode(cart.promoCode) : undefined;
  const promo = candidate && evaluatePromo(candidate).ok ? candidate : undefined;
  return {
    cart,
    products,
    promo,
    totals: priceCart({ lines: cart.lines, products, promo, shippingMethod }),
  };
}

export function cartItemCount(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}
