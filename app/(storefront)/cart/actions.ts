"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCart, saveCart } from "@/lib/cart/server";
import { addLine, findVariant, removeLine, setLineQuantity } from "@/lib/commerce/cart";
import { evaluatePromo, PROMO_REJECTION_MESSAGES, describePromo } from "@/lib/commerce/promo";
import { db } from "@/lib/db";

export interface CartActionState {
  ok?: boolean;
  error?: string;
  message?: string;
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

export async function addToCart(
  _prev: CartActionState,
  formData: FormData,
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

  const cart = await getCart();
  await saveCart({
    ...cart,
    lines: addLine(cart.lines, product.id, parsed.data.quantity, variantId),
  });
  revalidateCart();
  return { ok: true, message: `Added ${product.name} to your cart.` };
}

/** Quick add from a product card: no feedback state, the cart badge updates. */
export async function quickAddToCart(formData: FormData): Promise<void> {
  await addToCart({}, formData);
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
  const cart = await getCart();
  await saveCart({ ...cart, lines: removeLine(cart.lines, productId) });
  revalidateCart();
}

/** Shared by the cart form and the promo landing page. */
export async function applyPromoCode(code: string): Promise<CartActionState> {
  const parsed = PromoCodeSchema.safeParse({ code });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a promo code." };
  const promo = await db.promos.getByCode(parsed.data.code);
  const evaluation = evaluatePromo(promo);
  if (!evaluation.ok) return { error: PROMO_REJECTION_MESSAGES[evaluation.reason] };
  const cart = await getCart();
  await saveCart({ ...cart, promoCode: evaluation.promo.code });
  revalidateCart();
  return {
    ok: true,
    message: `${evaluation.promo.code} applied: ${describePromo(evaluation.promo)}.`,
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
