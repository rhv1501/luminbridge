import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { badRequest, unauthorized, serverError } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function isTransientDbError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "ETIMEDOUT" || code === "ECONNRESET" || code === "EAI_AGAIN";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase() as string | undefined;
  const password = body?.password as string | undefined;
  const requestedRole = body?.role as string | undefined;
  if (!email) return badRequest("email required");
  if (!password) return badRequest("password required");

  type UserRow = {
    id: number;
    email: string;
    role: string;
    company_name: string | null;
    wechat_id: string | null;
    mobile_number: string | null;
    whatsapp_number: string | null;
    password_hash: string | null;
    email_verified: boolean;
    approval_status: string;
    must_change_password: boolean;
  };

  const query = () => sql<UserRow[]>`
    SELECT
      id::int as id,
      email,
      role,
      company_name,
      wechat_id,
      mobile_number,
      whatsapp_number,
      password_hash,
      COALESCE(email_verified, false) as email_verified,
      COALESCE(approval_status, 'pending_verification') as approval_status,
      COALESCE(must_change_password, false) as must_change_password
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  let users: UserRow[];
  try {
    users = await query();
  } catch (err) {
    if (isTransientDbError(err)) {
      try {
        await new Promise((r) => setTimeout(r, 300));
        users = await query();
      } catch {
        return serverError("Database is temporarily unavailable. Please try again in a moment.");
      }
    } else {
      return serverError("Unable to sign in right now. Please try again.");
    }
  }

  if (users!.length === 0) return unauthorized("User not found");

  const user = users![0];

  // If a role was provided (portal-scoped login), enforce it.
  // This prevents logging into a different portal by accident and avoids
  // setting a session cookie for the wrong role.
  if (requestedRole && user.role !== requestedRole) {
    return unauthorized("Not authorized for this portal");
  }

  if (!user.email_verified) {
    return unauthorized("Email not verified. Please verify from your email link.");
  }

  if (user.approval_status === "pending_verification") {
    return unauthorized("Please verify your email first.");
  }

  if (user.approval_status === "pending") {
    return unauthorized("Awaiting admin approval.");
  }

  if (user.approval_status === "disapproved") {
    return unauthorized("Account disapproved by admin.");
  }

  if (!verifyPassword(password, user.password_hash)) {
    return unauthorized("Invalid email or password");
  }

  const sessionUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    company_name: user.company_name,
    wechat_id: user.wechat_id,
    mobile_number: user.mobile_number,
    whatsapp_number: user.whatsapp_number,
    must_change_password: user.must_change_password,
  };

  const res = NextResponse.json(sessionUser, {
    headers: { "Cache-Control": "no-store" },
  });
  res.cookies.set("lumina_session", JSON.stringify(sessionUser), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
