"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";
import { applyPromoCode, type CartActionState } from "../../cart/actions";

export function PromoLanding({ code }: { code: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [result, setResult] = useState<CartActionState | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    applyPromoCode(code).then((state) => {
      setResult(state);
      if (state.ok) {
        analytics.track("Promo Applied", { code, source: "link" });
        router.replace("/products");
      }
    });
  }, [code, router]);

  if (result?.error) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">{code}</h1>
        <p className="mt-2 text-destructive" role="alert">
          {result.error}
        </p>
        <Button asChild className="mt-6">
          <Link href="/products">Keep shopping</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Applying {code}…</h1>
      <p className="mt-2 text-muted-foreground" role="status">
        {result?.message ?? "One moment while we add the code to your cart."}
      </p>
    </>
  );
}
