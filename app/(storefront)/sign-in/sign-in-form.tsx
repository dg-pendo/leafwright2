"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pendo } from "@/lib/pendo/client";
import { signInAction, type SignInState } from "./actions";

/** Failed attempts already recorded. Every attempt returns a new state object. */
const recordedFailures = new WeakSet<SignInState>();

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});

  useEffect(() => {
    if (!state.failureReason || recordedFailures.has(state)) return;
    recordedFailures.add(state);
    pendo.track("sign_in_failed", { reason: state.failureReason, callbackUrl });
  }, [state, callbackUrl]);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
          data-testid="signin-email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          data-testid="signin-password"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} data-testid="signin-submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
