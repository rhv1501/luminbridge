import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { badRequest, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = body?.email as string | undefined;
  const requestedRole = body?.role as string | undefined;
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

  const user = users[0];

  // If a role was provided (portal-scoped login), enforce it.
  // This prevents logging into a different portal by accident and avoids
  // setting a session cookie for the wrong role.
  if (requestedRole && user.role !== requestedRole) {
    return unauthorized("Not authorized for this portal");
  }

  const res = NextResponse.json(user, {
    headers: { "Cache-Control": "no-store" },
  });
  res.cookies.set("lumina_session", JSON.stringify(user), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
