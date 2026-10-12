"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { cartItemCount, getCart, saveCart } from "@/lib/cart/server";
import { addLine, findVariant, removeLine, setLineQuantity, unitPrice } from "@/lib/commerce/cart";
import {
  evaluatePromo,
  PROMO_REJECTION_MESSAGES,
  describePromo,
  type PromoRejection,
} from "@/lib/commerce/promo";
import { db } from "@/lib/db";
import type { PromoType } from "@/lib/db/schema";
import { shopperActor, trackServerEvent } from "@/lib/pendo/server";

/** Why a promo code was turned down: the input itself, or the state of the promo it names. */
export type PromoRejectionReason = PromoRejection | "invalid_input";

export interface CartActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** The promo that was applied and how many items the cart holds. */
  appliedPromo?: {
    code: string;
    type: PromoType;
    value: number;
    storeId: string;
    cartItemCount: number;
  };
  promoRejection?: PromoRejectionReason;
}

const AddToCartSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});

const LineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(0).max(20),
});

const PromoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter a promo code.")
    .max(32)
    .transform((value) => value.toUpperCase()),
});

function revalidateCart() {
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

/** Where a product was added from: its detail page or a product card's quick add. */
type AddToCartSource = "product_detail" | "quick_add";

async function addProductToCart(
  formData: FormData,
  source: AddToCartSource,
): Promise<CartActionState> {
  const parsed = AddToCartSchema.safeParse({
    productId: formData.get("productId"),
    variantId: formData.get("variantId") || undefined,
    quantity: formData.get("quantity") ?? 1,
  });
  if (!parsed.success) return { error: "Choose a quantity between 1 and 20." };

  const product = await db.products.getById(parsed.data.productId);
  if (!product || product.status !== "published") return { error: "That product isn't available." };

  const variantId =
    parsed.data.variantId && findVariant(product, parsed.data.variantId)
      ? parsed.data.variantId
      : product.variants[0]?.id;

  const [session, cart] = await Promise.all([auth(), getCart()]);
  const lines = addLine(cart.lines, product.id, parsed.data.quantity, variantId);
  await saveCart({ ...cart, lines });
  revalidateCart();

  const variant = findVariant(product, variantId);
  trackServerEvent("product_added_to_cart", shopperActor(session, cart.id), {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    category: product.category,
    storeId: product.storeId,
    variantId: variant?.id ?? null,
    variantLabel: variant?.label ?? null,
    quantity: parsed.data.quantity,
    unitPrice: unitPrice(product, variant),
    source,
    cartItemCount: cartItemCount({ ...cart, lines }),
  });
  return { ok: true, message: `Added ${product.name} to your cart.` };
}

export async function addToCart(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  return addProductToCart(formData, "product_detail");
}

/** Quick add from a product card: no feedback state, the cart badge updates. */
export async function quickAddToCart(formData: FormData): Promise<void> {
  await addProductToCart(formData, "quick_add");
}

export async function updateCartLine(formData: FormData): Promise<void> {
  const parsed = LineSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return;
  const cart = await getCart();
  await saveCart({
    ...cart,
    lines: setLineQuantity(cart.lines, parsed.data.productId, parsed.data.quantity),
  });
  revalidateCart();
}

export async function removeFromCart(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  if (typeof productId !== "string" || !productId) return;
  const [session, cart] = await Promise.all([auth(), getCart()]);
  const removed = cart.lines.find((line) => line.productId === productId);
  const lines = removeLine(cart.lines, productId);
  await saveCart({ ...cart, lines });
  revalidateCart();
  if (!removed) return;

  const product = await db.products.getById(productId);
  trackServerEvent("product_removed_from_cart", shopperActor(session, cart.id), {
    productId,
    productSlug: product?.slug,
    variantId: removed.variantId ?? null,
    quantityRemoved: removed.quantity,
    storeId: product?.storeId,
    cartItemCountAfter: cartItemCount({ ...cart, lines }),
  });
}

/** Shared by the cart form and the promo landing page. */
export async function applyPromoCode(code: string): Promise<CartActionState> {
  const parsed = PromoCodeSchema.safeParse({ code });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Enter a promo code.",
      promoRejection: "invalid_input",
    };
  const promo = await db.promos.getByCode(parsed.data.code);
  const evaluation = evaluatePromo(promo);
  if (!evaluation.ok)
    return {
      error: PROMO_REJECTION_MESSAGES[evaluation.reason],
      promoRejection: evaluation.reason,
    };
  const cart = await getCart();
  await saveCart({ ...cart, promoCode: evaluation.promo.code });
  revalidateCart();
  return {
    ok: true,
    message: `${evaluation.promo.code} applied: ${describePromo(evaluation.promo)}.`,
    appliedPromo: {
      code: evaluation.promo.code,
      type: evaluation.promo.type,
      value: evaluation.promo.value,
      storeId: evaluation.promo.storeId,
      cartItemCount: cartItemCount(cart),
    },
  };
}

export async function applyPromo(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const code = formData.get("code");
  return applyPromoCode(typeof code === "string" ? code : "");
}

export async function removePromo(): Promise<void> {
  const cart = await getCart();
  await saveCart({ ...cart, promoCode: undefined });
  revalidateCart();
}
