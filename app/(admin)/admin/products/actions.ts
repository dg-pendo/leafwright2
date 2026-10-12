"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentMerchant } from "@/lib/auth/merchant";
import { CATEGORY_META } from "@/lib/catalog";
import { db } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import {
  CategorySchema,
  DifficultySchema,
  LightSchema,
  WaterSchema,
  type Product,
} from "@/lib/db/schema";
import { fieldErrors, formValue } from "@/lib/orders/checkout";
import { getRecordSource } from "@/lib/request-source";
import { slugify } from "@/lib/slug";

export interface ProductFormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

const dollars = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a price like 24.99")
  .transform((value) => Math.round(Number(value) * 100));

const ProductInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Give the product a name.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and dashes.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  category: CategorySchema,
  price: dollars,
  compareAtPrice: dollars.optional().or(z.literal("").transform(() => undefined)),
  inventory: z.coerce.number().int().min(0, "Inventory can't be negative."),
  description: z.string().trim().max(2000),
  light: LightSchema,
  water: WaterSchema,
  difficulty: DifficultySchema,
  petSafe: z.boolean(),
});

function readForm(formData: FormData) {
  return ProductInputSchema.safeParse({
    id: formValue(formData, "id") || undefined,
    name: formValue(formData, "name"),
    slug: formValue(formData, "slug") ?? "",
    category: formValue(formData, "category"),
    price: formValue(formData, "price"),
    compareAtPrice: formValue(formData, "compareAtPrice") ?? "",
    inventory: formValue(formData, "inventory") ?? "0",
    description: formValue(formData, "description") ?? "",
    light: formValue(formData, "light") ?? "medium",
    water: formValue(formData, "water") ?? "medium",
    difficulty: formValue(formData, "difficulty") ?? "easy",
    petSafe: formData.get("petSafe") === "on",
  });
}

async function upsert(
  formData: FormData,
  publish: boolean,
): Promise<ProductFormState | { id: string }> {
  const merchant = await currentMerchant();
  if (!merchant) return { error: "Sign in to a store to manage products." };
  const parsed = readForm(formData);
  if (!parsed.success)
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;

  const existing = input.id ? await db.products.getById(input.id) : undefined;
  if (input.id && (!existing || existing.storeId !== merchant.store.id)) {
    return { error: "That product isn't in your store." };
  }

  const slug = input.slug ?? existing?.slug ?? slugify(input.name);
  const clash = await db.products.getBySlug(slug);
  if (clash && clash.id !== existing?.id) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: { slug: "Another product already uses this URL." },
    };
  }

  const now = new Date().toISOString();
  const status: Product["status"] = publish ? "published" : (existing?.status ?? "draft");
  const product: Product = {
    id: existing?.id ?? newId("prod"),
    storeId: merchant.store.id,
    slug,
    name: input.name,
    description: input.description,
    category: input.category,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    status,
    inventory: input.inventory,
    images: existing?.images.length ? existing.images : [CATEGORY_META[input.category].image],
    variants: existing?.variants ?? [],
    care: {
      light: input.light,
      water: input.water,
      difficulty: input.difficulty,
      petSafe: input.petSafe,
    },
    source: existing?.source ?? (await getRecordSource()),
    createdAt: existing?.createdAt ?? now,
    publishedAt: publish ? (existing?.publishedAt ?? now) : existing?.publishedAt,
  };
  await (existing ? db.products.update(product.id, product) : db.products.create(product));
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { id: product.id };
}

/** Creates or updates the product without changing a published product's status. */
export async function saveProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const result = await upsert(formData, false);
  if (!("id" in result)) return result;
  redirect(`/admin/products/${result.id}?saved=1`);
}

export async function publishProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const result = await upsert(formData, true);
  if (!("id" in result)) return result;
  redirect(`/admin/products/${result.id}?published=1`);
}

export async function archiveProduct(formData: FormData): Promise<void> {
  const merchant = await currentMerchant();
  const id = formValue(formData, "id");
  if (!merchant || !id) return;
  const product = await db.products.getById(id);
  if (!product || product.storeId !== merchant.store.id) return;
  await db.products.update(id, { status: "archived" });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/products");
}
