import { sql } from "@/lib/db";
import { badRequest, jsonNoStore, toInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const userId = toInt(url.searchParams.get("userId"));

  if (role === "factory") {
    if (!userId) return badRequest("userId required");
    const products = await sql`
      SELECT
        id::int as id,
        name,
        description,
        specifications,
        photo,
        factory_price_cny,
        buyer_price_inr,
        status,
        factory_id::int as factory_id,
        category,
        created_at::text as created_at
      FROM products
      WHERE factory_id = ${userId}
    `;
    return jsonNoStore(products);
  }

  if (role === "admin") {
    const products = await sql`
      SELECT
        p.id::int as id,
        p.name,
        p.description,
        p.specifications,
        p.photo,
        p.factory_price_cny,
        p.buyer_price_inr,
        p.status,
        p.factory_id::int as factory_id,
        p.category,
        p.created_at::text as created_at,
        u.company_name as factory_company,
        u.email as factory_email,
        u.wechat_id as factory_wechat,
        u.mobile_number as factory_mobile
      FROM products p
      JOIN users u ON p.factory_id = u.id
    `;
    return jsonNoStore(products);
  }

  // buyers and others
  const products = await sql`
    SELECT
      id::int as id,
      name,
      description,
      specifications,
      photo,
      factory_price_cny,
      buyer_price_inr,
      status,
      factory_id::int as factory_id,
      category,
      created_at::text as created_at
    FROM products
    WHERE status = 'published'
  `;
  return jsonNoStore(products);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = body?.name as string | undefined;
  const description = body?.description as string | undefined;
  const specifications = body?.specifications as string | undefined;
  const photo = body?.photo as string | undefined;
  const factory_price_cny = body?.factory_price_cny as number | undefined;
  const factory_id = body?.factory_id as number | undefined;
  const category = (body?.category as string | undefined) ?? null;

  if (!name) return badRequest("name required");
  if (!factory_id) return badRequest("factory_id required");

  const rows = await sql<{ id: number }[]>`
    INSERT INTO products (name, description, specifications, photo, factory_price_cny, factory_id, category)
    VALUES (${name}, ${description ?? null}, ${specifications ?? null}, ${photo ?? null}, ${factory_price_cny ?? null}, ${factory_id}, ${category})
    RETURNING id::int as id
  `;

  return jsonNoStore({ id: rows[0].id });
}
