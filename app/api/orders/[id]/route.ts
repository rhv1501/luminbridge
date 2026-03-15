import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { refreshAdmins, refreshUsers } from "@/lib/realtimeRefresh";
import type { ParameterOrJSON } from "postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) return badRequest("Invalid order ID");

  const body = await req.json().catch(() => null);
  const status = body?.status as string | undefined;
  const rejection_reason = body?.rejection_reason as string | undefined;
  const quantity = body?.quantity as number | undefined;

  // 24-hour lock check (ported from the old Express backend)
  const created = await sql<{ created_at: string }[]>`
    SELECT created_at::text as created_at
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;

  if (created.length > 0) {
    const orderDate = new Date(created[0].created_at).getTime();
    const now = Date.now();
    const hoursPassed = (now - orderDate) / (1000 * 60 * 60);

    if (
      status &&
      status !== "pending" &&
      status !== "accepted" &&
      status !== "rejected" &&
      hoursPassed < 24
    ) {
      return jsonNoStore(
        { error: "Order is locked for 24 hours after creation" },
        { status: 400 },
      );
    }
  }

  const setClauses: string[] = [];
  const values: ParameterOrJSON<never>[] = [];
  let idx = 1;

  if (status !== undefined) {
    setClauses.push(`status = $${idx++}`);
    values.push(status);
    if (status === "pending") {
      setClauses.push(`created_at = NOW()`);
    }
  }

  if (rejection_reason !== undefined) {
    setClauses.push(`rejection_reason = $${idx++}`);
    values.push(rejection_reason);
  }

  if (quantity !== undefined) {
    setClauses.push(`quantity = $${idx++}`);
    values.push(quantity);
  }

  if (setClauses.length > 0) {
    values.push(orderId);
    await sql.unsafe(`UPDATE orders SET ${setClauses.join(", ")} WHERE id = $${idx}`, values);
  }

  // Realtime refresh for all impacted portals (admin, buyer, factory)
  try {
    const rows = await sql<{
      buyer_id: number;
      factory_id: number;
    }[]>`
      SELECT
        o.buyer_id::int as buyer_id,
        p.factory_id::int as factory_id
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ${orderId}
      LIMIT 1
    `;

    const r = rows[0];
    await Promise.all([
      refreshAdmins({ resource: "orders", action: "updated", id: orderId }),
      refreshUsers(
        [r?.buyer_id, r?.factory_id].filter(Boolean) as number[],
        { resource: "orders", action: "updated", id: orderId },
      ),
    ]);
  } catch (e) {
    console.error("Failed to publish order refresh", e);
  }

  // Notifications
  try {
    const orders = await sql<{
      buyer_id: number;
      product_name: string | null;
      factory_id: number;
      factory_company: string | null;
    }[]>`
      SELECT
        o.buyer_id::int as buyer_id,
        p.name as product_name,
        p.factory_id::int as factory_id,
        f.company_name as factory_company
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users f ON p.factory_id = f.id
      WHERE o.id = ${orderId}
      LIMIT 1
    `;

    const admins = await sql<{ id: number }[]>`
      SELECT id::int as id
      FROM users
      WHERE role = 'admin'
      ORDER BY id
      LIMIT 1
    `;

    const order = orders[0];

    if (order && status) {
      let message = `Order #${orderId} for ${order.product_name} has been ${status}.`;
      if (status === "rejected" && rejection_reason) {
        message += ` Reason: ${rejection_reason}`;
      }

      await createNotification(order.buyer_id, message, "order", orderId);

      if (admins[0]?.id) {
        await createNotification(
          admins[0].id,
          `Order #${orderId} status updated to ${status} by ${order.factory_company}.`,
          "order",
          orderId,
        );
      }
    }
  } catch (e) {
    console.error("Failed to create order update notifications", e);
  }

  return jsonNoStore({ success: true });
}
