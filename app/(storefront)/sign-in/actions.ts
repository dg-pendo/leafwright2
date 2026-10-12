"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { authenticate, CredentialsSchema } from "@/lib/auth/credentials";
import { mergeAnonymousCart } from "@/lib/cart/server";
import { trackServerEvent } from "@/lib/pendo/server";

/** Why a sign-in attempt was turned away. Never carries the email or password. */
export type SignInFailureReason = "invalid_input" | "invalid_credentials" | "auth_error";

export interface SignInState {
  error?: string;
  values?: { email: string };
  failureReason?: SignInFailureReason;
}

const SignInInputSchema = CredentialsSchema.extend({
  callbackUrl: z.string().optional(),
});

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = SignInInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") ?? undefined,
  });
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your details.",
      values: { email },
      failureReason: "invalid_input",
    };
  }

  const user = await authenticate(parsed.data);
  if (!user)
    return {
      error: "That email and password don't match.",
      values: { email },
      failureReason: "invalid_credentials",
    };
  const merge = await mergeAnonymousCart(user.id);
  const redirectTo = safeCallbackUrl(parsed.data.callbackUrl);

  // signIn() ends in a redirect on success, so the sign-in is recorded just before it.
  trackServerEvent(
    "user_signed_in",
    { visitorId: user.id, accountId: user.storeId },
    {
      role: user.role,
      storeId: user.storeId ?? null,
      callbackUrl: redirectTo,
      hadAnonymousCart: merge.hadAnonymousCart,
      cartLinesMerged: merge.linesMerged,
    },
  );

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "That email and password don't match.",
        values: { email },
        failureReason: "auth_error",
      };
    }
    throw error;
  }
  return {};
}
