"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentMerchant } from "@/lib/auth/merchant";
import { db } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { PromoTypeSchema, type Promo } from "@/lib/db/schema";
import { fieldErrors, formValue } from "@/lib/orders/checkout";

export interface PromoFormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

const PromoInputSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{3,20}$/, "Use 3–20 letters or numbers."),
    type: PromoTypeSchema,
    value: z.coerce.number().min(0, "Value can't be negative."),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date."),
    isActive: z.boolean(),
  })
  .refine((input) => input.endsAt >= input.startsAt, {
    path: ["endsAt"],
    message: "End date must be after the start.",
  })
  .refine((input) => input.type !== "percent" || input.value <= 100, {
    path: ["value"],
    message: "Percent must be 100 or less.",
  });

export async function savePromo(
  _prev: PromoFormState,
  formData: FormData,
): Promise<PromoFormState> {
  const merchant = await currentMerchant();
  if (!merchant) return { error: "Sign in to a store to manage promos." };
  const parsed = PromoInputSchema.safeParse({
    id: formValue(formData, "id") || undefined,
    code: formValue(formData, "code"),
    type: formValue(formData, "type"),
    value: formValue(formData, "value") ?? "0",
    startsAt: formValue(formData, "startsAt"),
    endsAt: formValue(formData, "endsAt"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success)
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;

  const existing = input.id ? await db.promos.getById(input.id) : undefined;
  if (input.id && (!existing || existing.storeId !== merchant.store.id))
    return { error: "That promo isn't in your store." };
  const clash = await db.promos.getByCode(input.code);
  if (clash && clash.id !== existing?.id) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: { code: "That code is already in use." },
    };
  }

  const promo: Promo = {
    id: existing?.id ?? newId("promo"),
    storeId: merchant.store.id,
    code: input.code,
    type: input.type,
    value:
      input.type === "fixed"
        ? Math.round(input.value * 100)
        : input.type === "percent"
          ? Math.round(input.value)
          : 0,
    startsAt: new Date(`${input.startsAt}T00:00:00.000Z`).toISOString(),
    endsAt: new Date(`${input.endsAt}T23:59:59.000Z`).toISOString(),
    isActive: input.isActive,
    usageCount: existing?.usageCount ?? 0,
  };
  await (existing ? db.promos.update(promo.id, promo) : db.promos.create(promo));
  revalidatePath("/admin/promos");
  revalidatePath("/");
  redirect("/admin/promos?saved=1");
}

export async function togglePromo(formData: FormData): Promise<void> {
  const merchant = await currentMerchant();
  const id = formValue(formData, "id");
  if (!merchant || !id) return;
  const promo = await db.promos.getById(id);
  if (!promo || promo.storeId !== merchant.store.id) return;
  await db.promos.update(id, { isActive: !promo.isActive });
  revalidatePath("/admin/promos");
  revalidatePath("/");
}
