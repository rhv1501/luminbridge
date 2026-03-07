import { sql } from "@/lib/db";
import { badRequest, jsonNoStore, toInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = toInt(url.searchParams.get("userId"));
  if (!userId) return badRequest("userId required");

  const notifications = await sql<{
    id: number;
    user_id: number;
    message: string;
    type: string | null;
    related_id: number | null;
    is_read: number;
    created_at: string;
  }[]>`
    SELECT
      id::int as id,
      user_id::int as user_id,
      message,
      type,
      related_id::int as related_id,
      is_read::int as is_read,
      created_at::text as created_at
    FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return jsonNoStore(notifications);
}
