import { sql } from "@/lib/db";
import { jsonNoStore, toInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
      JOIN custom_orders co ON cop.custom_order_id = co.id
      WHERE co.buyer_id = ${userId ?? -1} AND cop.status = 'published'
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
      WHERE cop.factory_id = ${userId ?? -1}
    `;
    return jsonNoStore(proposals);
  }

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
  `;

  return jsonNoStore(proposals);
}
