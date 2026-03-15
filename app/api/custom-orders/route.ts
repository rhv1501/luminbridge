import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { refreshAdmins, refreshFactories, refreshUsers } from "@/lib/realtimeRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const userId = url.searchParams.get("userId");

  if (role === "admin" || role === "factory") {
    const orders = await sql`
      SELECT
        co.id::int as id,
        co.buyer_id::int as buyer_id,
        co.photo,
        co.requirements,
        co.status,
        co.created_at::text as created_at,
        u.company_name as buyer_company,
        u.email as buyer_email
      FROM custom_orders co
      JOIN users u ON co.buyer_id = u.id
      ORDER BY co.created_at DESC
    `;
    return jsonNoStore(orders);
  }

  if (!userId) return badRequest("userId required");

  const orders = await sql`
    SELECT
      co.id::int as id,
      co.buyer_id::int as buyer_id,
      co.photo,
      co.requirements,
      co.status,
      co.created_at::text as created_at,
      u.company_name as buyer_company,
      u.email as buyer_email
    FROM custom_orders co
    JOIN users u ON co.buyer_id = u.id
    WHERE co.buyer_id = ${Number.parseInt(userId, 10)}
    ORDER BY co.created_at DESC
  `;

  return jsonNoStore(orders);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const buyer_id = body?.buyer_id as number | undefined;
  const photo = (body?.photo as string | undefined) ?? null;
  const requirements = (body?.requirements as string | undefined) ?? null;

  if (!buyer_id) return badRequest("buyer_id required");

  const rows = await sql<{ id: number }[]>`
    INSERT INTO custom_orders (buyer_id, photo, requirements)
    VALUES (${buyer_id}, ${photo}, ${requirements})
    RETURNING id::int as id
  `;

  const id = rows[0].id;

  // Realtime refresh signals
  await Promise.all([
    refreshAdmins({ resource: "custom-orders", action: "created", id }),
    refreshFactories({ resource: "custom-orders", action: "created", id }),
    refreshUsers([buyer_id], { resource: "custom-orders", action: "created", id }),
  ]);

  // Notifications
  try {
    const buyers = await sql<{ company_name: string | null }[]>`
      SELECT company_name
      FROM users
      WHERE id = ${buyer_id}
      LIMIT 1
    `;
    const buyerCompany = buyers[0]?.company_name ?? "(unknown buyer)";

    const admins = await sql<{ id: number }[]>`
      SELECT id::int as id
      FROM users
      WHERE role = 'admin'
      ORDER BY id
      LIMIT 1
    `;

    if (admins[0]?.id) {
      await createNotification(
        admins[0].id,
        `New custom order request #${id} placed by ${buyerCompany}`,
        "custom-order",
        id,
      );
    }

    const factories = await sql<{ id: number }[]>`
      SELECT id::int as id
      FROM users
      WHERE role = 'factory'
    `;

    await Promise.all(
      factories.map((factory) =>
        createNotification(
          factory.id,
          `New custom order request #${id} available for proposal`,
          "custom-order",
          id,
        ),
      ),
    );
  } catch (e) {
    console.error("Failed to create custom order notifications", e);
  }

  return jsonNoStore({ id });
}
