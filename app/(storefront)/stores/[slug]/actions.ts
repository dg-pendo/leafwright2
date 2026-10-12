"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const FollowSchema = z.object({ storeId: z.string().min(1), slug: z.string().min(1) });

export async function followStore(formData: FormData): Promise<void> {
  const parsed = FollowSchema.safeParse({
    storeId: formData.get("storeId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;

  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/stores/${parsed.data.slug}`)}`);
  }

  const user = await db.users.getById(session.user.id);
  if (!user) return;
  const following = user.followedStoreIds.includes(parsed.data.storeId);
  await db.users.update(user.id, {
    followedStoreIds: following
      ? user.followedStoreIds.filter((id) => id !== parsed.data.storeId)
      : [...user.followedStoreIds, parsed.data.storeId],
  });
  revalidatePath(`/stores/${parsed.data.slug}`);
}
