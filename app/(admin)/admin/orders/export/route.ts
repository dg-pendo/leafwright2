import { ordersToCsv } from "@/lib/admin/csv";
import { analytics } from "@/lib/analytics";
import { filterRange, parseOrderFilters } from "@/lib/admin/order-filters";
import { currentMerchant } from "@/lib/auth/merchant";
import { db } from "@/lib/db";

export async function GET(request: Request): Promise<Response> {
  const merchant = await currentMerchant();
  if (!merchant) return new Response("Sign in to a store to export orders.", { status: 401 });

  const filters = parseOrderFilters(new URL(request.url).searchParams);
  const orders = await db.orders.list({
    storeId: merchant.store.id,
    status: filters.status,
    ...filterRange(filters),
  });
  const users = new Map((await db.users.list()).map((user) => [user.id, user.email]));
  const csv = ordersToCsv(orders, (order) =>
    order.customerId ? (users.get(order.customerId) ?? "") : (order.guestEmail ?? ""),
  );

  analytics.track("Orders Exported", {
    storeId: merchant.store.id,
    status: filters.status ?? null,
    from: filters.from ?? null,
    to: filters.to ?? null,
    count: orders.length,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${merchant.store.slug}-orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
