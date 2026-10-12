"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMerchant } from "@/lib/auth/merchant";
import { daysUntil } from "@/lib/dates";
import { db } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { MerchantRoleSchema, PlanSchema } from "@/lib/db/schema";
import { fieldErrors, formValue } from "@/lib/orders/checkout";
import { merchantActor, trackServerEvent } from "@/lib/pendo/server";

export interface SettingsState {
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

const StoreSchema = z.object({
  name: z.string().trim().min(2, "Give the store a name.").max(60),
  description: z.string().trim().max(500),
  region: z.string().trim().min(2, "Where do you ship from?").max(60),
});

export async function updateStore(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const merchant = await currentMerchant();
  if (!merchant) return { error: "Sign in to a store first." };
  const parsed = StoreSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description") ?? "",
    region: formValue(formData, "region"),
  });
  if (!parsed.success)
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const fieldsChanged = (["name", "region", "description"] as const).filter(
    (field) => parsed.data[field] !== merchant.store[field],
  );
  await db.stores.update(merchant.store.id, parsed.data);
  trackServerEvent("store_details_updated", merchantActor(merchant), {
    storeId: merchant.store.id,
    fieldsChanged,
    descriptionLength: parsed.data.description.length,
    plan: merchant.store.plan,
  });
  refresh();
  return { message: "Store details saved." };
}

const InviteSchema = z.object({
  email: z.email("Enter a valid email address."),
  role: MerchantRoleSchema,
});

export async function inviteMember(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const merchant = await currentMerchant();
  if (!merchant) return { error: "Sign in to a store first." };
  if (merchant.user.role !== "owner") return { error: "Only the owner can invite team members." };
  const parsed = InviteSchema.safeParse({
    email: formValue(formData, "email"),
    role: formValue(formData, "role") ?? "staff",
  });
  if (!parsed.success)
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const email = parsed.data.email.toLowerCase();
  const existing = await db.users.getByEmail(email);
  if (existing?.storeId === merchant.store.id)
    return { error: "That person is already on your team." };
  const invites = await db.invites.listByStore(merchant.store.id);
  const pending = invites.find((invite) => invite.email === email);
  if (pending) return { error: "An invite is already out to that address." };

  await db.invites.create({
    id: newId("invite"),
    storeId: merchant.store.id,
    email,
    role: parsed.data.role,
    sentAt: new Date().toISOString(),
  });
  const team = await db.users.listByStore(merchant.store.id);
  trackServerEvent("team_member_invited", merchantActor(merchant), {
    storeId: merchant.store.id,
    invitedRole: parsed.data.role,
    plan: merchant.store.plan,
    pendingInviteCount: invites.length + 1,
    teamSize: team.length,
  });
  revalidatePath("/admin/settings/team");
  return { message: `Invite sent to ${email}.` };
}

export async function changePlan(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const merchant = await currentMerchant();
  if (!merchant) return { error: "Sign in to a store first." };
  if (merchant.user.role !== "owner") return { error: "Only the owner can change the plan." };
  const parsed = PlanSchema.safeParse(formValue(formData, "plan"));
  if (!parsed.success) return { error: "Pick a plan." };
  if (parsed.data === merchant.store.plan) return { message: "You're already on that plan." };
  const previousPlan = merchant.store.plan;
  const trialDaysRemaining = merchant.store.trialEndsAt
    ? daysUntil(merchant.store.trialEndsAt)
    : null;
  await db.stores.update(merchant.store.id, {
    plan: parsed.data,
    trialEndsAt: parsed.data === "starter" ? merchant.store.trialEndsAt : undefined,
  });
  trackServerEvent("plan_changed", merchantActor(merchant), {
    storeId: merchant.store.id,
    previousPlan,
    newPlan: parsed.data,
    changeType:
      PlanSchema.options.indexOf(parsed.data) > PlanSchema.options.indexOf(previousPlan)
        ? "upgrade"
        : "downgrade",
    wasInTrial: previousPlan === "starter" && Boolean(trialDaysRemaining),
    trialDaysRemaining,
    userRole: merchant.user.role,
  });
  refresh();
  return { message: `Switched to the ${parsed.data} plan.` };
}

const PayoutSchema = z.object({
  account: z.string().regex(/^\d{8,17}$/, "Enter the account number without spaces."),
  routing: z.string().regex(/^\d{9}$/, "Routing numbers are 9 digits."),
});

export async function updatePayout(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const merchant = await currentMerchant();
  if (!merchant) return { error: "Sign in to a store first." };
  if (merchant.user.role !== "owner") return { error: "Only the owner can change payout details." };
  const parsed = PayoutSchema.safeParse({
    account: formValue(formData, "account")?.replace(/\s/g, ""),
    routing: formValue(formData, "routing")?.replace(/\s/g, ""),
  });
  if (!parsed.success)
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const isFirstPayoutAccount = !merchant.store.payoutAccountLast4;
  await db.stores.update(merchant.store.id, { payoutAccountLast4: parsed.data.account.slice(-4) });
  // Whether this is the first account on file; never the account or routing numbers.
  trackServerEvent("payout_account_updated", merchantActor(merchant), {
    storeId: merchant.store.id,
    isFirstPayoutAccount,
    plan: merchant.store.plan,
    userRole: merchant.user.role,
  });
  revalidatePath("/admin/settings/payouts");
  return { message: "Payout account updated. Only the last four digits are kept." };
}
