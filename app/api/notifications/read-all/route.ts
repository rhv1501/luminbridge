import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const userId = body?.userId as number | undefined;
  if (!userId) return badRequest("userId required");

  await sql`UPDATE notifications SET is_read = TRUE WHERE user_id = ${userId}`;
  return jsonNoStore({ success: true });
}
