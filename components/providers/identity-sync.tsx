"use client";

import { useEffect } from "react";
import type { VisitorIdentity } from "@/lib/auth/identity";

/** Associates this browser session with the signed-in user and, for merchants, their store. */
export function IdentitySync({ identity }: { identity: VisitorIdentity }) {
  useEffect(() => {
    window.pendo?.identify(identity);
  }, [identity]);
  return null;
}
