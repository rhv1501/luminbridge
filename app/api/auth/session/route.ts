import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/session — returns the current user from the HttpOnly cookie */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get("lumina_session");
  if (!session?.value) return unauthorized("No session");
  try {
    const user = JSON.parse(session.value);
    return NextResponse.json(user, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return unauthorized("Invalid session");
  }
}

/** DELETE /api/auth/session — clears the session cookie (logout) */
export async function DELETE() {
  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  res.cookies.delete("lumina_session");
  return res;
}
