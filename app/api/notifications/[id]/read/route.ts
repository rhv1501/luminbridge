import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = Number.parseInt(id, 10);
  if (!Number.isFinite(parsed)) return badRequest("Invalid notification ID");

  await sql`UPDATE notifications SET is_read = TRUE WHERE id = ${parsed}`;
  return jsonNoStore({ success: true });
}
