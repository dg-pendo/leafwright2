import type { VisitorIdentity } from "@/lib/auth/identity";

declare global {
  /**
   * Defined by the inline script in the root layout, which queues calls until the agent script
   * loads. `clearSession` is only available once it has loaded.
   */
  var pendo:
    | {
        identify: (identity: VisitorIdentity) => void;
        clearSession?: () => void;
      }
    | undefined;
}
