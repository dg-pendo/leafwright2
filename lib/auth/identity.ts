import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Plan, Role } from "@/lib/db/schema";

export interface VisitorIdentity {
  visitor: {
    id: string;
    email: string;
    full_name: string;
    role: Role;
    storeId?: string;
    createdAt: string;
    lastSignInAt: string;
    followedStoreIds: string[];
  };
  /** The merchant's store. Shoppers belong to no store, so they have no account. */
  account?: {
    id: string;
    name: string;
    slug: string;
    plan: Plan;
    trialEndsAt: string | null;
    region: string;
    createdAt: string;
  };
}

/**
 * The signed-in user and, for merchants, their store, read from the data layer so profile and
 * plan changes show up without signing in again. `null` for guests.
 */
export async function currentIdentity(): Promise<VisitorIdentity | null> {
  const session = await auth();
  if (!session?.user) return null;
  try {
    const [user, store] = await Promise.all([
      db.users.getById(session.user.id),
      session.store ? db.stores.getById(session.store.id) : undefined,
    ]);
    if (!user) return null;
    const visitor = {
      id: user.id,
      email: user.email,
      full_name: user.name,
      role: user.role,
      storeId: user.storeId,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      followedStoreIds: user.followedStoreIds,
    };
    if (!store) return { visitor };
    return {
      visitor,
      account: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        plan: store.plan,
        trialEndsAt: store.trialEndsAt ?? null,
        region: store.region,
        createdAt: store.createdAt,
      },
    };
  } catch {
    // Identifying the visitor is best-effort; a failed read must never fail the page.
    return null;
  }
}
