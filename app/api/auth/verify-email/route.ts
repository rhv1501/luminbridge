import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { badRequest } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return badRequest("token required");

  const rows = await sql<{
    token_id: number;
    user_id: number;
    email: string;
    role: "buyer" | "factory" | "admin";
    company_name: string | null;
  }[]>`
    SELECT
      evt.id::int as token_id,
      u.id::int as user_id,
      u.email,
      u.role,
      u.company_name
    FROM email_verification_tokens evt
    JOIN users u ON u.id = evt.user_id
    WHERE evt.token = ${token}
      AND evt.used_at IS NULL
      AND evt.expires_at > NOW()
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.redirect(new URL("/buyer/login?verified=invalid", req.url));
  }

  const verified = rows[0];

  await sql`
    UPDATE email_verification_tokens
    SET used_at = NOW()
    WHERE id = ${verified.token_id}
  `;

  await sql`
    UPDATE users
    SET
      email_verified = TRUE,
      approval_status = CASE
        WHEN approval_status = 'pending_verification' THEN 'pending'
        ELSE approval_status
      END
    WHERE id = ${verified.user_id}
  `;

  const admins = await sql<{ id: number; email: string }[]>`
    SELECT id::int as id, email
    FROM users
    WHERE role = 'admin'
  `;

  const accountLabel = `${verified.role.toUpperCase()} ${verified.email}${verified.company_name ? ` (${verified.company_name})` : ""}`;

  await Promise.all(
    admins.map(async (admin) => {
      await createNotification(
        admin.id,
        `New account verified and waiting approval: ${accountLabel}`,
        "account-approval",
        verified.user_id,
      );

      await sendEmail({
        to: admin.email,
        subject: "Account approval required",
        text: `A new account is verified and waiting approval: ${accountLabel}`,
      });
    }),
  );

  return NextResponse.redirect(
    new URL(`/${verified.role}/login?verified=1`, req.url),
  );
}
