import { cookies } from "next/headers";
import { badRequest, unauthorized, jsonNoStore } from "@/lib/api";
import { sql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get("lumina_session");
  if (!session?.value) return unauthorized("No session");

  let userId: number;
  try {
    const sessionUser = JSON.parse(session.value) as { id?: number };
    if (!sessionUser.id) return unauthorized("Invalid session");
    userId = sessionUser.id;
  } catch {
    return unauthorized("Invalid session");
  }

  const body = await req.json().catch(() => null);
  const currentPassword = body?.currentPassword as string | undefined;
  const newPassword = body?.newPassword as string | undefined;

  if (!currentPassword) return badRequest("currentPassword required");
  if (!newPassword) return badRequest("newPassword required");
  if (newPassword.length < 8) return badRequest("New password must be at least 8 characters");

  const users = await sql<{ password_hash: string | null }[]>`
    SELECT password_hash
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (users.length === 0) return unauthorized("User not found");
  if (!verifyPassword(currentPassword, users[0].password_hash)) {
    return unauthorized("Current password is incorrect");
  }

  const nextHash = hashPassword(newPassword);
  await sql`
    UPDATE users
    SET
      password_hash = ${nextHash},
      must_change_password = FALSE
    WHERE id = ${userId}
  `;

  return jsonNoStore({ ok: true });
}
