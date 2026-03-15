import { sql } from "@/lib/db";
import { jsonNoStore } from "@/lib/api";
import { refreshAdmins } from "@/lib/realtimeRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value
    FROM settings
  `;

  const settings = rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return jsonNoStore(settings);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const exchange_rate = body?.exchange_rate;
  const admin_markup = body?.admin_markup;

  if (exchange_rate !== undefined) {
    await sql`
      INSERT INTO settings (key, value)
      VALUES ('exchange_rate', ${String(exchange_rate)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }

  if (admin_markup !== undefined) {
    await sql`
      INSERT INTO settings (key, value)
      VALUES ('admin_markup', ${String(admin_markup)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }

  await refreshAdmins({ resource: "settings", action: "updated" });
  return jsonNoStore({ success: true });
}
