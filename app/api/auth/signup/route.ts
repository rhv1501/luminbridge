import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = body?.email as string | undefined;
  const role = body?.role as string | undefined;
  const company_name = (body?.company_name as string | undefined) ?? null;
  const wechat_id = (body?.wechat_id as string | undefined) ?? null;
  const mobile_number = (body?.mobile_number as string | undefined) ?? null;
  const whatsapp_number = (body?.whatsapp_number as string | undefined) ?? null;

  if (!email) return badRequest("email required");
  if (!role) return badRequest("role required");
  if (role === "admin") return badRequest("Admin signup is disabled");

  try {
    const users = await sql<{
      id: number;
      email: string;
      role: string;
      company_name: string | null;
      wechat_id: string | null;
      mobile_number: string | null;
      whatsapp_number: string | null;
    }[]>`
      INSERT INTO users (email, role, company_name, wechat_id, mobile_number, whatsapp_number)
      VALUES (${email}, ${role}, ${company_name}, ${wechat_id}, ${mobile_number}, ${whatsapp_number})
      RETURNING
        id::int as id,
        email,
        role,
        company_name,
        wechat_id,
        mobile_number,
        whatsapp_number
    `;

    return jsonNoStore(users[0]);
  } catch (error) {
    console.error("Signup error:", error);
    return badRequest("Email already exists or invalid data");
  }
}
