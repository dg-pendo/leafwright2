"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatMoney } from "@/lib/commerce/cart";
import type { ShippingMethod } from "@/lib/db/schema";
import { placeOrder, type CheckoutState } from "./actions";

interface Defaults {
  email: string;
  name: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postal: string;
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CheckoutForm({
  signedIn,
  defaults,
  shippingRates,
}: {
  signedIn: boolean;
  defaults: Defaults;
  shippingRates: Record<ShippingMethod, number>;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-8" noValidate>
      <section className="space-y-4">
        <h2 className="font-semibold">Contact</h2>
        <Field id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={defaults.email}
            readOnly={signedIn}
            data-testid="checkout-email"
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Shipping address</h2>
        <Field id="name" label="Full name" error={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={defaults.name}
            data-testid="checkout-name"
          />
        </Field>
        <Field id="address1" label="Address" error={errors.address1}>
          <Input
            id="address1"
            name="address1"
            autoComplete="street-address"
            defaultValue={defaults.address1}
            data-testid="checkout-address1"
          />
        </Field>
        <Field id="address2" label="Apartment, suite, etc. (optional)" error={errors.address2}>
          <Input
            id="address2"
            name="address2"
            autoComplete="address-line2"
            defaultValue={defaults.address2}
            data-testid="checkout-address2"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="city" label="City" error={errors.city}>
            <Input
              id="city"
              name="city"
              autoComplete="address-level2"
              defaultValue={defaults.city}
              data-testid="checkout-city"
            />
          </Field>
          <Field id="region" label="State" error={errors.region}>
            <Input
              id="region"
              name="region"
              autoComplete="address-level1"
              defaultValue={defaults.region}
              data-testid="checkout-region"
            />
          </Field>
          <Field id="postal" label="Postal code" error={errors.postal}>
            <Input
              id="postal"
              name="postal"
              autoComplete="postal-code"
              inputMode="numeric"
              defaultValue={defaults.postal}
              data-testid="checkout-postal"
            />
          </Field>
        </div>
        <Field id="phone" label="Phone (optional)" error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={defaults.phone}
            data-testid="checkout-phone"
          />
        </Field>
        {signedIn ? (
          <div className="flex items-center gap-2">
            <Checkbox id="saveAddress" name="saveAddress" data-testid="checkout-save-address" />
            <Label htmlFor="saveAddress">Save this address to my account</Label>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Shipping method</h2>
        <RadioGroup
          name="shippingMethod"
          defaultValue="standard"
          data-testid="checkout-shipping-method"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="standard" id="ship-standard" />
            <Label htmlFor="ship-standard">
              Standard (3–5 days) · {formatMoney(shippingRates.standard)}, free over $75 per nursery
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="express" id="ship-express" />
            <Label htmlFor="ship-express">
              Express (1–2 days) · {formatMoney(shippingRates.express)}
            </Label>
          </div>
        </RadioGroup>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Payment</h2>
        <Field id="cardNumber" label="Card number" error={errors.cardNumber}>
          <Input
            id="cardNumber"
            name="cardNumber"
            autoComplete="cc-number"
            inputMode="numeric"
            placeholder="4242 4242 4242 4242"
            data-testid="checkout-card-number"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cardExpiry" label="Expiry (MM/YY)" error={errors.cardExpiry}>
            <Input
              id="cardExpiry"
              name="cardExpiry"
              autoComplete="cc-exp"
              inputMode="numeric"
              placeholder="12/30"
              data-testid="checkout-card-expiry"
            />
          </Field>
          <Field id="cardCvc" label="Security code" error={errors.cardCvc}>
            <Input
              id="cardCvc"
              name="cardCvc"
              autoComplete="cc-csc"
              inputMode="numeric"
              placeholder="123"
              data-testid="checkout-card-cvc"
            />
          </Field>
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        disabled={pending}
        data-testid="checkout-place-order"
      >
        {pending ? "Placing order…" : "Place order"}
      </Button>
    </form>
  );
}
