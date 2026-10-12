"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analytics } from "@/lib/analytics";
import { pendo } from "@/lib/pendo/client";
import { applyPromo, removePromo, type CartActionState } from "./actions";

export function PromoForm({
  appliedCode,
  appliedDescription,
}: {
  appliedCode?: string;
  appliedDescription?: string;
}) {
  const [state, action, pending] = useActionState<CartActionState, FormData>(
    async (prev, formData) => {
      const result = await applyPromo(prev, formData);
      const code = String(formData.get("code") ?? "")
        .trim()
        .toUpperCase();
      if (result.ok) {
        analytics.track("Promo Applied", { code, source: "cart" });
        pendo.track("promo_applied", {
          code,
          source: "cart",
          promoType: result.appliedPromo?.type,
          promoValue: result.appliedPromo?.value,
          promoStoreId: result.appliedPromo?.storeId,
          cartItemCount: result.appliedPromo?.cartItemCount,
        });
      } else if (result.promoRejection) {
        pendo.track("promo_code_rejected", { code, reason: result.promoRejection, source: "cart" });
      }
      return result;
    },
    {},
  );

  return (
    <div className="mt-4">
      <form action={action} className="flex items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="cart-promo-input">Promo code</Label>
          <Input
            id="cart-promo-input"
            name="code"
            placeholder="FERN15"
            autoComplete="off"
            className="uppercase"
            data-testid="cart-promo-input"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending} data-testid="cart-promo-apply">
          Apply
        </Button>
      </form>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {appliedCode ? (
        <div
          role="status"
          className="mt-2 flex items-center justify-between text-sm text-emerald-700"
        >
          <span>
            {appliedCode} applied
            {appliedDescription ? `: ${appliedDescription}` : " (not valid for these items)"}
          </span>
          <form action={removePromo}>
            <button
              type="submit"
              className="text-muted-foreground underline"
              data-testid="cart-promo-remove"
            >
              Remove
            </button>
          </form>
        </div>
      ) : state.message ? (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
