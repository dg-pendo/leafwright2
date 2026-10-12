"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { authenticate, CredentialsSchema } from "@/lib/auth/credentials";
import { mergeAnonymousCart } from "@/lib/cart/server";

export interface SignInState {
  error?: string;
  values?: { email: string };
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
    return { error: parsed.error.issues[0]?.message ?? "Check your details.", values: { email } };
  }

  const user = await authenticate(parsed.data);
  if (!user) return { error: "That email and password don't match.", values: { email } };
  await mergeAnonymousCart(user.id);

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCallbackUrl(parsed.data.callbackUrl),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "That email and password don't match.", values: { email } };
    }
    throw error;
  }
  return {};
}
