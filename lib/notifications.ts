import { sql, withDbRetry } from "@/lib/db";
import { publishUserEventExternal } from "@/lib/realtime";

export async function createNotification(
  userId: number,
  message: string,
  type?: string,
  relatedId?: number,
) {
  const rows = await withDbRetry(() =>
    sql<{ id: number }[]>`
      INSERT INTO notifications (user_id, message, type, related_id)
      VALUES (${userId}, ${message}, ${type ?? null}, ${relatedId ?? null})
      RETURNING id::int as id
    `,
  );

  await publishUserEventExternal(userId, "notifications", {
    action: "created",
    id: rows[0]?.id,
    type: type ?? null,
    relatedId: relatedId ?? null,
    ts: Date.now(),
  });
}
