"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fieldErrors, formValue, SaveAddressSchema, saveAddress } from "@/lib/orders/checkout";

export interface AccountState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

const ProfileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  phone: z.string().trim().max(32).optional(),
});

export async function saveProfile(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in to update your profile." };
  const parsed = ProfileSchema.safeParse({
    name: formValue(formData, "name"),
    phone: formValue(formData, "phone"),
  });
  if (!parsed.success)
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  await db.users.update(session.user.id, {
    name: parsed.data.name,
    phone: parsed.data.phone || undefined,
  });
  revalidatePath("/account");
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function addAddress(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in to save an address." };
  const parsed = SaveAddressSchema.safeParse({
    label: formValue(formData, "label") || "Home",
    name: session.user.name,
    address1: formValue(formData, "address1"),
    address2: formValue(formData, "address2"),
    city: formValue(formData, "city"),
    region: formValue(formData, "region"),
    postal: formValue(formData, "postal"),
  });
  if (!parsed.success)
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  await saveAddress(session.user.id, parsed.data);
  revalidatePath("/account");
  return { ok: true, message: "Address added." };
}

export async function removeAddress(formData: FormData): Promise<void> {
  const session = await auth();
  const id = formValue(formData, "addressId");
  if (!session?.user || !id) return;
  const address = await db.addresses.getById(id);
  if (!address || address.userId !== session.user.id) return;
  await db.addresses.remove(id);
  revalidatePath("/account");
}

export async function makeDefaultAddress(formData: FormData): Promise<void> {
  const session = await auth();
  const id = formValue(formData, "addressId");
  if (!session?.user || !id) return;
  const addresses = await db.addresses.listByUser(session.user.id);
  if (!addresses.some((address) => address.id === id)) return;
  for (const address of addresses) {
    if (address.isDefault !== (address.id === id)) {
      await db.addresses.update(address.id, { isDefault: address.id === id });
    }
  }
  revalidatePath("/account");
}
