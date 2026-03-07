import { sql } from "@/lib/db";

export async function createNotification(
  userId: number,
  message: string,
  type?: string,
  relatedId?: number,
) {
  await sql`
    INSERT INTO notifications (user_id, message, type, related_id)
    VALUES (${userId}, ${message}, ${type ?? null}, ${relatedId ?? null})
  `;
}
