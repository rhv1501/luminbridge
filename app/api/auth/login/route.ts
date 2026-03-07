import { sql } from "@/lib/db";
import { badRequest, jsonNoStore, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = body?.email as string | undefined;
  if (!email) return badRequest("email required");

  const users = await sql<{
    id: number;
    email: string;
    role: string;
    company_name: string | null;
    wechat_id: string | null;
    mobile_number: string | null;
    whatsapp_number: string | null;
  }[]>`
    SELECT
      id::int as id,
      email,
      role,
      company_name,
      wechat_id,
      mobile_number,
      whatsapp_number
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  if (users.length === 0) return unauthorized("User not found");
  return jsonNoStore(users[0]);
}
