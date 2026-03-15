import { sql } from "@/lib/db";
import { publishUserEventExternal } from "@/lib/realtime";

export type RefreshResource =
  | "orders"
  | "products"
  | "custom-orders"
  | "custom-order-proposals"
  | "notifications"
  | "settings";

export type RefreshPayload = {
  resource: RefreshResource;
  action: "created" | "updated" | "deleted";
  id?: number;
  ts: number;
};

export async function refreshUsers(userIds: number[], payload: Omit<RefreshPayload, "ts">) {
  const unique = Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
  if (unique.length === 0) return;

  const data: RefreshPayload = { ...payload, ts: Date.now() };
  await Promise.all(unique.map((userId) => publishUserEventExternal(userId, "refresh", data)));
}

export async function refreshRole(role: "admin" | "factory" | "buyer", payload: Omit<RefreshPayload, "ts">) {
  const rows = await sql<{ id: number }[]>`
    SELECT id::int as id
    FROM users
    WHERE role = ${role}
  `;
  await refreshUsers(
    rows.map((r) => r.id),
    payload,
  );
}

export async function refreshAdmins(payload: Omit<RefreshPayload, "ts">) {
  return refreshRole("admin", payload);
}

export async function refreshFactories(payload: Omit<RefreshPayload, "ts">) {
  return refreshRole("factory", payload);
}

export async function refreshBuyers(payload: Omit<RefreshPayload, "ts">) {
  return refreshRole("buyer", payload);
}
