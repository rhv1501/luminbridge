import { sql } from "@/lib/db";
import { badRequest, jsonNoStore, toInt } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const customOrderId = Number.parseInt(id, 10);
  if (!Number.isFinite(customOrderId)) return badRequest("Invalid custom order ID");

  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const userId = toInt(url.searchParams.get("userId"));

  if (role === "buyer") {
    const proposals = await sql`
      SELECT
        cop.id::int as id,
        cop.custom_order_id::int as custom_order_id,
        cop.factory_id::int as factory_id,
        cop.photo,
        cop.description,
        cop.price_cny,
        cop.price_inr,
        cop.status,
        cop.created_at::text as created_at,
        u.company_name as factory_company
      FROM custom_order_proposals cop
      JOIN users u ON cop.factory_id = u.id
      WHERE cop.custom_order_id = ${customOrderId} AND cop.status = 'published'
    `;
    return jsonNoStore(proposals);
  }

  if (role === "factory") {
    const proposals = await sql`
      SELECT
        cop.id::int as id,
        cop.custom_order_id::int as custom_order_id,
        cop.factory_id::int as factory_id,
        cop.photo,
        cop.description,
        cop.price_cny,
        cop.price_inr,
        cop.status,
        cop.created_at::text as created_at,
        u.company_name as factory_company
      FROM custom_order_proposals cop
      JOIN users u ON cop.factory_id = u.id
      WHERE cop.custom_order_id = ${customOrderId} AND cop.factory_id = ${userId ?? -1}
    `;
    return jsonNoStore(proposals);
  }

  // Admins see all proposals + contact info
  const proposals = await sql`
    SELECT
      cop.id::int as id,
      cop.custom_order_id::int as custom_order_id,
      cop.factory_id::int as factory_id,
      cop.photo,
      cop.description,
      cop.price_cny,
      cop.price_inr,
      cop.status,
      cop.created_at::text as created_at,
      u.company_name as factory_company,
      u.email as factory_email,
      u.mobile_number as factory_mobile,
      u.wechat_id as factory_wechat
    FROM custom_order_proposals cop
    JOIN users u ON cop.factory_id = u.id
    WHERE cop.custom_order_id = ${customOrderId}
  `;

  return jsonNoStore(proposals);
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const customOrderId = Number.parseInt(id, 10);
  if (!Number.isFinite(customOrderId)) return badRequest("Invalid custom order ID");

  const body = await req.json().catch(() => null);
  const factory_id = body?.factory_id as number | undefined;
  const photo = (body?.photo as string | undefined) ?? null;
  const description = (body?.description as string | undefined) ?? null;
  const price_cny = body?.price_cny as number | undefined;

  if (!factory_id) return badRequest("factory_id required");

  const rows = await sql<{ id: number }[]>`
    INSERT INTO custom_order_proposals (custom_order_id, factory_id, photo, description, price_cny)
    VALUES (${customOrderId}, ${factory_id}, ${photo}, ${description}, ${price_cny ?? null})
    RETURNING id::int as id
  `;

  const proposalId = rows[0].id;

  // If custom order is pending, bump to sourcing
  const current = await sql<{ status: string }[]>`
    SELECT status
    FROM custom_orders
    WHERE id = ${customOrderId}
    LIMIT 1
  `;

  if (current[0]?.status === "pending") {
    await sql`UPDATE custom_orders SET status = 'sourcing' WHERE id = ${customOrderId}`;
  }

  // Notify Admin
  try {
    const admins = await sql<{ id: number }[]>`
      SELECT id::int as id
      FROM users
      WHERE role = 'admin'
      ORDER BY id
      LIMIT 1
    `;

    const factories = await sql<{ company_name: string | null }[]>`
      SELECT company_name
      FROM users
      WHERE id = ${factory_id}
      LIMIT 1
    `;

    const factoryCompany = factories[0]?.company_name ?? "(unknown factory)";

    if (admins[0]?.id) {
      await createNotification(
        admins[0].id,
        `New proposal for Custom Order #${customOrderId} from ${factoryCompany}`,
        "custom-order",
        customOrderId,
      );
    }
  } catch (e) {
    console.error("Failed to create proposal notification", e);
  }

  return jsonNoStore({ id: proposalId });
}
