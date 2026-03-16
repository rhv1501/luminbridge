import { cookies } from "next/headers";
import { unauthorized, jsonNoStore } from "@/lib/api";
import { isTransientDbError, sql, withDbRetry } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("lumina_session");
  if (!session?.value) return null;
  try {
    const user = JSON.parse(session.value) as { role?: string };
    if (user.role !== "admin") return null;
    return user;
  } catch {
    return null;
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized("Admin only");

  try {
    const accounts = await withDbRetry(() =>
      sql<{
        id: number;
        email: string;
        role: "buyer" | "factory";
        company_name: string | null;
        wechat_id: string | null;
        mobile_number: string | null;
        whatsapp_number: string | null;
        email_verified: boolean;
        approval_status: string;
        approval_note: string | null;
        must_change_password: boolean;
        created_at: string;
        approved_at: string | null;
        disapproved_at: string | null;
      }[]>`
        SELECT
          id::int as id,
          email,
          role,
          company_name,
          wechat_id,
          mobile_number,
          whatsapp_number,
          COALESCE(email_verified, false) as email_verified,
          COALESCE(approval_status, 'pending_verification') as approval_status,
          approval_note,
          COALESCE(must_change_password, false) as must_change_password,
          created_at::text as created_at,
          approved_at::text as approved_at,
          disapproved_at::text as disapproved_at
        FROM users
        WHERE role IN ('buyer', 'factory')
        ORDER BY created_at DESC
      `,
    );

    return jsonNoStore(accounts);
  } catch (error) {
    if (isTransientDbError(error)) {
      return jsonNoStore(
        { error: "Database is temporarily unavailable. Please try again in a moment." },
        { status: 503 },
      );
    }

    return jsonNoStore({ error: "Unable to load accounts right now." }, { status: 500 });
  }
}
