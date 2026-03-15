import { sql } from "@/lib/db";
import { badRequest, jsonNoStore } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { refreshAdmins, refreshUsers } from "@/lib/realtimeRefresh";
import type { ParameterOrJSON } from "postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const proposalId = Number.parseInt(id, 10);
  if (!Number.isFinite(proposalId)) return badRequest("Invalid proposal ID");

  const body = await req.json().catch(() => null);
  const price_inr = body?.price_inr as number | undefined;
  const status = body?.status as string | undefined;

  const setClauses: string[] = [];
  const values: ParameterOrJSON<never>[] = [];
  let idx = 1;

  if (price_inr !== undefined) {
    setClauses.push(`price_inr = $${idx++}`);
    values.push(price_inr);
  }

  if (status !== undefined) {
    setClauses.push(`status = $${idx++}`);
    values.push(status);
  }

  if (setClauses.length > 0) {
    values.push(proposalId);
    await sql.unsafe(
      `UPDATE custom_order_proposals SET ${setClauses.join(", ")} WHERE id = $${idx}`,
      values,
    );
  }

  // Realtime refresh for impacted portals
  try {
    const rows = await sql<{
      factory_id: number;
      custom_order_id: number;
      buyer_id: number;
    }[]>`
      SELECT
        cop.factory_id::int as factory_id,
        cop.custom_order_id::int as custom_order_id,
        co.buyer_id::int as buyer_id
      FROM custom_order_proposals cop
      JOIN custom_orders co ON cop.custom_order_id = co.id
      WHERE cop.id = ${proposalId}
      LIMIT 1
    `;

    const r = rows[0];
    await Promise.all([
      refreshAdmins({
        resource: "custom-order-proposals",
        action: "updated",
        id: proposalId,
      }),
      refreshUsers(
        [r?.factory_id, r?.buyer_id].filter(Boolean) as number[],
        {
          resource: "custom-order-proposals",
          action: "updated",
          id: proposalId,
        },
      ),
    ]);
  } catch (e) {
    console.error("Failed to publish proposal refresh", e);
  }

  // Notify Factory (and Buyer on publish)
  if (status) {
    try {
      const proposals = await sql<{
        factory_id: number;
        custom_order_id: number;
      }[]>`
        SELECT factory_id::int as factory_id, custom_order_id::int as custom_order_id
        FROM custom_order_proposals
        WHERE id = ${proposalId}
        LIMIT 1
      `;

      const proposal = proposals[0];
      if (proposal) {
        await createNotification(
          proposal.factory_id,
          `Your proposal for Custom Order #${proposal.custom_order_id} has been ${status}`,
          "custom-order",
          proposal.custom_order_id,
        );

        if (status === "published") {
          const orders = await sql<{ buyer_id: number }[]>`
            SELECT buyer_id::int as buyer_id
            FROM custom_orders
            WHERE id = ${proposal.custom_order_id}
            LIMIT 1
          `;

          const buyerId = orders[0]?.buyer_id;
          if (buyerId) {
            await createNotification(
              buyerId,
              `A proposal for your Custom Order #${proposal.custom_order_id} is now available for review.`,
              "custom-order",
              proposal.custom_order_id,
            );
          }
        }
      }
    } catch (e) {
      console.error("Failed to create proposal update notification", e);
    }
  }

  return jsonNoStore({ success: true });
}
