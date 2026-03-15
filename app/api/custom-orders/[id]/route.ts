import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";
import { refreshAdmins, refreshFactories, refreshUsers } from "@/lib/realtimeRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) return badRequest("Invalid custom order ID");

  const body = await req.json().catch(() => null);
  const status = body?.status as string | undefined;
  if (!status) return badRequest("status required");

  await sql`UPDATE custom_orders SET status = ${status} WHERE id = ${orderId}`;

  try {
    const rows = await sql<{ buyer_id: number }[]>`
      SELECT buyer_id::int as buyer_id
      FROM custom_orders
      WHERE id = ${orderId}
      LIMIT 1
    `;
    const buyerId = rows[0]?.buyer_id;
    await Promise.all([
      refreshAdmins({ resource: "custom-orders", action: "updated", id: orderId }),
      refreshFactories({ resource: "custom-orders", action: "updated", id: orderId }),
      ...(buyerId
        ? [
            refreshUsers([buyerId], {
              resource: "custom-orders",
              action: "updated",
              id: orderId,
            }),
          ]
        : []),
    ]);
  } catch (e) {
    console.error("Failed to publish custom order refresh", e);
  }
  return jsonNoStore({ success: true });
}
