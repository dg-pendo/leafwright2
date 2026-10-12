import { z } from "zod";
import { CardSchema } from "@/lib/commerce/payment";
import { db } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { ShippingMethodSchema, type Address } from "@/lib/db/schema";

export const AddressFieldsSchema = z.object({
  name: z.string().trim().min(1, "Enter the recipient's name."),
  address1: z.string().trim().min(1, "Enter a street address."),
  address2: z.string().trim().optional(),
  city: z.string().trim().min(1, "Enter a city."),
  region: z.string().trim().min(2, "Enter a state or region."),
  postal: z.string().trim().min(3, "Enter a postal code."),
  phone: z.string().trim().optional(),
});

export const PlaceOrderSchema = AddressFieldsSchema.extend({
  email: z.email("Enter a valid email address."),
  shippingMethod: ShippingMethodSchema,
  saveAddress: z.boolean(),
}).and(CardSchema);

export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;

export const SaveAddressSchema = AddressFieldsSchema.extend({
  label: z.string().trim().min(1).max(40).default("Home"),
});

export function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function fieldErrors(error: z.ZodError): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Stores an address on the signed-in user's profile. Shared by checkout and the account page. */
export async function saveAddress(
  userId: string,
  input: z.infer<typeof SaveAddressSchema>,
): Promise<Address> {
  const existing = await db.addresses.listByUser(userId);
  const duplicate = existing.find(
    (address) =>
      address.line1.toLowerCase() === input.address1.toLowerCase() &&
      address.postalCode === input.postal,
  );
  if (duplicate) return duplicate;
  return db.addresses.create({
    id: newId("addr"),
    userId,
    label: input.label,
    line1: input.address1,
    line2: input.address2 || undefined,
    city: input.city,
    region: input.region,
    postalCode: input.postal,
    country: "US",
    isDefault: existing.length === 0,
  });
}
