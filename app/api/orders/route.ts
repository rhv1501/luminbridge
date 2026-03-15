import { sql } from "@/lib/db";
import { badRequest, jsonNoStore, toInt } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { refreshAdmins, refreshUsers } from "@/lib/realtimeRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const product_id = body?.product_id as number | undefined;
  const buyer_id = body?.buyer_id as number | undefined;
  const quantity = body?.quantity as number | undefined;

  if (!product_id) return badRequest("product_id required");
  if (!buyer_id) return badRequest("buyer_id required");
  if (!quantity) return badRequest("quantity required");

  const rows = await sql<{ id: number }[]>`
    INSERT INTO orders (product_id, buyer_id, quantity)
    VALUES (${product_id}, ${buyer_id}, ${quantity})
    RETURNING id::int as id
  `;

  const id = rows[0].id;

  // Realtime refresh signals (for all portals)
  // - Admins: global order list
  // - Buyer: their order list
  // - Factory: their received order list (derived from product.factory_id)
  // We already query product.factory_id below for notifications; use it here too.

  // Notifications
  try {
    const products = await sql<{
      name: string | null;
      factory_id: number | null;
    }[]>`
      SELECT name, factory_id::int as factory_id
      FROM products
      WHERE id = ${product_id}
      LIMIT 1
    `;

    const buyers = await sql<{ company_name: string | null }[]>`
      SELECT company_name
      FROM users
      WHERE id = ${buyer_id}
      LIMIT 1
    `;

    const admins = await sql<{ id: number }[]>`
      SELECT id::int as id
      FROM users
      WHERE role = 'admin'
      ORDER BY id
      LIMIT 1
    `;

    const product = products[0];
    const buyerCompany = buyers[0]?.company_name ?? "(unknown buyer)";

    if (admins[0]?.id) {
      await createNotification(
        admins[0].id,
        `New order #${id} placed by ${buyerCompany} for ${quantity}x ${product?.name}`,
        "order",
        id,
      );
    }

    if (product?.factory_id) {
      await createNotification(
        product.factory_id,
        `New order #${id} received for ${quantity}x ${product?.name}`,
        "order",
        id,
      );
    }

    await Promise.all([
      refreshAdmins({ resource: "orders", action: "created", id }),
      refreshUsers(
        [buyer_id, ...(product?.factory_id ? [product.factory_id] : [])],
        { resource: "orders", action: "created", id },
      ),
    ]);
  } catch (e) {
    console.error("Failed to create order notifications", e);
  }

  return jsonNoStore({ id });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const userId = toInt(url.searchParams.get("userId"));

  if (role === "admin") {
    const orders = await sql`
      SELECT
        o.id::int as id,
        o.product_id::int as product_id,
        o.buyer_id::int as buyer_id,
        o.quantity,
        o.status,
        o.rejection_reason,
        o.created_at::text as created_at,
        p.name as product_name,
        p.photo as product_photo,
        u.email as buyer_email,
        u.company_name as buyer_company,
        u.whatsapp_number as buyer_whatsapp
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.buyer_id = u.id
    `;
    return jsonNoStore(orders);
  }

  if (role === "factory") {
    if (!userId) return badRequest("userId required");

    const orders = await sql`
      SELECT
        o.id::int as id,
        o.product_id::int as product_id,
        o.buyer_id::int as buyer_id,
        o.quantity,
        o.status,
        o.rejection_reason,
        o.created_at::text as created_at,
        p.name as product_name,
        p.photo as product_photo
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.factory_id = ${userId}
    `;
    return jsonNoStore(orders);
  }

  // buyer
  if (!userId) return badRequest("userId required");

  const orders = await sql`
    SELECT
      o.id::int as id,
      o.product_id::int as product_id,
      o.buyer_id::int as buyer_id,
      o.quantity,
      o.status,
      o.rejection_reason,
      o.created_at::text as created_at,
      p.name as product_name,
      p.photo as product_photo
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE o.buyer_id = ${userId}
  `;

  return jsonNoStore(orders);
}
