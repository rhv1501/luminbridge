import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const productId = Number.parseInt(id, 10);
  if (!Number.isFinite(productId)) return badRequest("Invalid product ID");

  const body = await req.json().catch(() => null);

  const updatable: Record<string, unknown> = {
    name: body?.name,
    description: body?.description,
    specifications: body?.specifications,
    factory_price_cny: body?.factory_price_cny,
    buyer_price_inr: body?.buyer_price_inr,
    status: body?.status,
    photo: body?.photo,
    category: body?.category,
  };

  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [column, value] of Object.entries(updatable)) {
    if (value === undefined) continue;
    setClauses.push(`${column} = $${idx++}`);
    values.push(value);
  }

  if (setClauses.length > 0) {
    values.push(productId);
    await sql.unsafe(
      `UPDATE products SET ${setClauses.join(", ")} WHERE id = $${idx}`,
      values,
    );
  }

  // Notifications: if status published, notify factory
  try {
    if (body?.status === "published") {
      const rows = await sql<{
        name: string | null;
        factory_id: number | null;
      }[]>`
        SELECT name, factory_id::int as factory_id
        FROM products
        WHERE id = ${productId}
        LIMIT 1
      `;
      const product = rows[0];
      if (product?.factory_id) {
        await createNotification(
          product.factory_id,
          `Your product "${product.name}" has been published by the admin.`,
          "product",
          productId,
        );
      }
    }
  } catch (e) {
    console.error("Failed to create product update notifications", e);
  }

  return jsonNoStore({ success: true });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const productId = Number.parseInt(id, 10);
  if (!Number.isFinite(productId)) return badRequest("Invalid product ID");

  const [{ count }] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM orders
    WHERE product_id = ${productId} AND status != 'fulfilled'
  `;

  if (count > 0) {
    return badRequest(`Cannot delete product with ${count} active (non-fulfilled) order(s)`);
  }

  const result = await sql<{ changes: number }[]>`
    WITH deleted AS (
      DELETE FROM products WHERE id = ${productId} RETURNING 1
    )
    SELECT COUNT(*)::int as changes FROM deleted
  `;

  if (result[0].changes === 0) {
    return jsonNoStore({ error: "Product not found" }, { status: 404 });
  }

  return jsonNoStore({ success: true });
}
