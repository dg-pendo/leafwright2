import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCart, priceStoredCart } from "@/lib/cart/server";
import { formatMoney, SHIPPING_RATES } from "@/lib/commerce/cart";
import { db } from "@/lib/db";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [session, cart] = await Promise.all([auth(), getCart()]);
  const { totals } = await priceStoredCart(cart);
  if (totals.itemCount === 0) redirect("/cart");

  const user = session?.user ? await db.users.getById(session.user.id) : undefined;
  const addresses = user ? await db.addresses.listByUser(user.id) : [];
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      {!session?.user ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Checking out as a guest.{" "}
          <Link
            href="/sign-in?callbackUrl=%2Fcheckout"
            className="underline"
            data-testid="checkout-sign-in"
          >
            Sign in
          </Link>{" "}
          to use a saved address.
        </p>
      ) : null}
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
        <CheckoutForm
          signedIn={Boolean(session?.user)}
          defaults={{
            email: user?.email ?? "",
            name: user?.name ?? "",
            phone: user?.phone ?? "",
            address1: defaultAddress?.line1 ?? "",
            address2: defaultAddress?.line2 ?? "",
            city: defaultAddress?.city ?? "",
            region: defaultAddress?.region ?? "",
            postal: defaultAddress?.postalCode ?? "",
          }}
          shippingRates={SHIPPING_RATES}
        />
        <aside className="h-fit rounded-xl border p-6">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-4 divide-y text-sm">
            {totals.groups.flatMap((group) =>
              group.lines.map(({ product, variant, line, lineTotal }) => (
                <li key={product.id} className="flex justify-between py-2">
                  <span>
                    {line.quantity} × {product.name}
                    {variant ? ` (${variant.label})` : ""}
                  </span>
                  <span>{formatMoney(lineTotal)}</span>
                </li>
              )),
            )}
          </ul>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatMoney(totals.subtotal)}</dd>
            </div>
            {totals.discount ? (
              <div className="flex justify-between text-emerald-700">
                <dt>Discount</dt>
                <dd>−{formatMoney(totals.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>{totals.shipping ? formatMoney(totals.shipping) : "Free"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Tax</dt>
              <dd>{formatMoney(totals.tax)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(totals.total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Shipping shown for the standard method; the total updates when the order is placed.
          </p>
        </aside>
      </div>
    </main>
  );
}
