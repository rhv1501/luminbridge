import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { refreshAdmins, refreshBuyers, refreshUsers } from "@/lib/realtimeRefresh";
import type { ParameterOrJSON } from "postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const productId = Number.parseInt(id, 10);
  if (!Number.isFinite(productId)) return badRequest("Invalid product ID");

  const body = await req.json().catch(() => null);

  // Capture current state so we can decide whether buyers need a refresh (e.g. unpublish).
  let beforeFactoryId: number | null = null;
  let beforeStatus: string | null = null;
  try {
    const before = await sql<{
      factory_id: number;
      status: string | null;
    }[]>`
      SELECT factory_id::int as factory_id, status
      FROM products
      WHERE id = ${productId}
      LIMIT 1
    `;
    beforeFactoryId = before[0]?.factory_id ?? null;
    beforeStatus = before[0]?.status ?? null;
  } catch {
    // ignore
  }

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
  const values: ParameterOrJSON<never>[] = [];
  let idx = 1;

  for (const [column, value] of Object.entries(updatable)) {
    if (value === undefined) continue;
    setClauses.push(`${column} = $${idx++}`);
    values.push(value as ParameterOrJSON<never>);
  }

  if (setClauses.length > 0) {
    values.push(productId);
    await sql.unsafe(
      `UPDATE products SET ${setClauses.join(", ")} WHERE id = $${idx}`,
      values,
    );
  }

  // Realtime refresh for impacted portals
  try {
    const rows = await sql<{
      factory_id: number;
      status: string | null;
    }[]>`
      SELECT factory_id::int as factory_id, status
      FROM products
      WHERE id = ${productId}
      LIMIT 1
    `;
    const product = rows[0];
    const factoryId = product?.factory_id ?? beforeFactoryId;
    const afterStatus = product?.status ?? null;
    const buyerRelevant = beforeStatus === "published" || afterStatus === "published";

    await Promise.all([
      refreshAdmins({ resource: "products", action: "updated", id: productId }),
      refreshUsers(
        factoryId ? [factoryId] : [],
        { resource: "products", action: "updated", id: productId },
      ),
      // Buyers care about the published catalog, including unpublish transitions
      ...(buyerRelevant
        ? [
            refreshBuyers({
              resource: "products",
              action: "updated",
              id: productId,
            }),
          ]
        : []),
    ]);
  } catch (e) {
    console.error("Failed to publish product refresh", e);
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

  // Capture owner for realtime refresh before deleting
  let factoryId: number | null = null;
  try {
    const owners = await sql<{ factory_id: number | null }[]>`
      SELECT factory_id::int as factory_id
      FROM products
      WHERE id = ${productId}
      LIMIT 1
    `;
    factoryId = owners[0]?.factory_id ?? null;
  } catch {
    // ignore
  }

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

  try {
    await Promise.all([
      refreshAdmins({ resource: "products", action: "deleted", id: productId }),
      refreshUsers(factoryId ? [factoryId] : [], {
        resource: "products",
        action: "deleted",
        id: productId,
      }),
      refreshBuyers({ resource: "products", action: "deleted", id: productId }),
    ]);
  } catch (e) {
    console.error("Failed to publish product delete refresh", e);
  }

  return jsonNoStore({ success: true });
}
