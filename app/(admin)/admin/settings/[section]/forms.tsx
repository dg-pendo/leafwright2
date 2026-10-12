"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Plan, Store } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { changePlan, inviteMember, updatePayout, updateStore, type SettingsState } from "./actions";

function Feedback({ state }: { state: SettingsState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="text-sm text-emerald-700">
        {state.message}
      </p>
    );
  return null;
}

export function StoreForm({ store }: { store: Store }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateStore, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-xl space-y-5" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="settings-store-name">Store name</Label>
        <Input
          id="settings-store-name"
          name="name"
          defaultValue={store.name}
          data-testid="settings-store-name"
        />
        {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="settings-store-slug">Storefront URL</Label>
        <Input
          id="settings-store-slug"
          value={`/stores/${store.slug}`}
          readOnly
          data-testid="settings-store-slug"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="settings-store-region">Ships from</Label>
        <Input
          id="settings-store-region"
          name="region"
          defaultValue={store.region}
          data-testid="settings-store-region"
        />
        {errors.region ? <p className="text-xs text-destructive">{errors.region}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="settings-store-description">About the nursery</Label>
        <Textarea
          id="settings-store-description"
          name="description"
          rows={4}
          defaultValue={store.description}
          data-testid="settings-store-description"
        />
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending} data-testid="settings-store-save">
        {pending ? "Saving…" : "Save store"}
      </Button>
    </form>
  );
}

export function InviteForm({ canInvite }: { canInvite: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(inviteMember, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form
      action={action}
      className="flex max-w-xl flex-wrap items-end gap-3"
      noValidate
      key={state.message}
    >
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="settings-invite-email">Email</Label>
        <Input
          id="settings-invite-email"
          name="email"
          type="email"
          autoComplete="off"
          disabled={!canInvite}
          data-testid="settings-invite-email"
        />
        {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="settings-invite-role">Role</Label>
        <Select name="role" defaultValue="staff" disabled={!canInvite}>
          <SelectTrigger
            id="settings-invite-role"
            className="w-32"
            data-testid="settings-invite-role"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={!canInvite || pending} data-testid="settings-invite-send">
        {pending ? "Sending…" : "Send invite"}
      </Button>
      <div className="basis-full">
        <Feedback state={state} />
        {!canInvite ? (
          <p className="text-sm text-muted-foreground">Only the owner can invite team members.</p>
        ) : null}
      </div>
    </form>
  );
}

const PLANS: Array<{ plan: Plan; name: string; price: string; blurb: string; features: string[] }> =
  [
    {
      plan: "starter",
      name: "Starter",
      price: "Free for 14 days",
      blurb: "Get your first products listed.",
      features: ["Up to 25 products", "Standard checkout", "Email support"],
    },
    {
      plan: "growth",
      name: "Growth",
      price: "$29 / month",
      blurb: "For nurseries shipping every week.",
      features: ["Unlimited products", "Promo codes", "Team seats"],
    },
    {
      plan: "pro",
      name: "Pro",
      price: "$79 / month",
      blurb: "See what sells and why.",
      features: ["Everything in Growth", "Sales analytics", "Assistant insights"],
    },
  ];

export function PlanCards({ currentPlan, canChange }: { currentPlan: Plan; canChange: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePlan, {});
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((item) => {
          const current = item.plan === currentPlan;
          return (
            <Card key={item.plan} className={cn(current && "border-emerald-600")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {item.name}
                  {current ? (
                    <span className="text-xs font-normal text-emerald-700">Current plan</span>
                  ) : null}
                </CardTitle>
                <CardDescription>{item.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-lg font-semibold">{item.price}</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {item.features.map((feature) => (
                    <li key={feature}>· {feature}</li>
                  ))}
                </ul>
                <form action={action}>
                  <input type="hidden" name="plan" value={item.plan} />
                  <Button
                    type="submit"
                    variant={current ? "secondary" : "default"}
                    className="w-full"
                    disabled={current || !canChange || pending}
                    data-testid={`settings-plan-${item.plan}`}
                  >
                    {current ? "Current plan" : `Switch to ${item.name}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Feedback state={state} />
      {!canChange ? (
        <p className="text-sm text-muted-foreground">Only the owner can change the plan.</p>
      ) : null}
    </div>
  );
}

export function PayoutForm({ last4, canEdit }: { last4?: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updatePayout, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-md space-y-5" noValidate key={state.message}>
      <p className="text-sm text-muted-foreground">
        {last4
          ? `Payouts currently go to the account ending in ${last4}.`
          : "No payout account on file yet."}
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="settings-payout-account">Account number</Label>
        <Input
          id="settings-payout-account"
          name="account"
          inputMode="numeric"
          autoComplete="off"
          disabled={!canEdit}
          data-testid="settings-payout-account"
        />
        {errors.account ? <p className="text-xs text-destructive">{errors.account}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="settings-payout-routing">Routing number</Label>
        <Input
          id="settings-payout-routing"
          name="routing"
          inputMode="numeric"
          autoComplete="off"
          disabled={!canEdit}
          data-testid="settings-payout-routing"
        />
        {errors.routing ? <p className="text-xs text-destructive">{errors.routing}</p> : null}
      </div>
      <Feedback state={state} />
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">Only the owner can change payout details.</p>
      ) : null}
      <Button type="submit" disabled={!canEdit || pending} data-testid="settings-payout-save">
        {pending ? "Saving…" : "Save payout account"}
      </Button>
    </form>
  );
}
