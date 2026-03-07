import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) return badRequest("Invalid custom order ID");

  const body = await req.json().catch(() => null);
  const status = body?.status as string | undefined;
  if (!status) return badRequest("status required");

  await sql`UPDATE custom_orders SET status = ${status} WHERE id = ${orderId}`;
  return jsonNoStore({ success: true });
}
