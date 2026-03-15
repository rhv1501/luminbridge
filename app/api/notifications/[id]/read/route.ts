import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";
import { publishUserEventExternal } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = Number.parseInt(id, 10);
  if (!Number.isFinite(parsed)) return badRequest("Invalid notification ID");

  const rows = await sql<{ user_id: number }[]>`
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = ${parsed}
    RETURNING user_id::int as user_id
  `;

  const userId = rows[0]?.user_id;
  if (userId) {
    await publishUserEventExternal(userId, "notifications", {
      action: "read",
      id: parsed,
      ts: Date.now(),
    });
  }
  return jsonNoStore({ success: true });
}
