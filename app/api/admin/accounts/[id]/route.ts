import { cookies } from "next/headers";
import { badRequest, jsonNoStore, notFound, unauthorized } from "@/lib/api";
import { sql } from "@/lib/db";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized("Admin only");

  const { id } = await context.params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isFinite(userId)) return badRequest("Invalid user id");

  const body = await req.json().catch(() => null);
  const action = body?.action as "approve" | "disapprove" | undefined;
  const note = (body?.note as string | undefined)?.trim() || null;
  if (!action) return badRequest("action required");

  const users = await sql<{
    id: number;
    email: string;
    role: "buyer" | "factory";
    email_verified: boolean;
    approval_status: string;
  }[]>`
    SELECT
      id::int as id,
      email,
      role,
      COALESCE(email_verified, false) as email_verified,
      COALESCE(approval_status, 'pending_verification') as approval_status
    FROM users
    WHERE id = ${userId} AND role IN ('buyer', 'factory')
    LIMIT 1
  `;

  if (users.length === 0) return notFound("User not found");
  const user = users[0];

  if (action === "approve") {
    if (!user.email_verified) {
      return badRequest("Cannot approve before email verification");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = hashPassword(temporaryPassword);

    await sql`
      UPDATE users
      SET
        is_approved = TRUE,
        approval_status = 'approved',
        approval_note = ${note},
        approved_at = NOW(),
        disapproved_at = NULL,
        password_hash = ${passwordHash},
        must_change_password = TRUE
      WHERE id = ${user.id}
    `;

    await sendEmail({
      to: user.email,
      subject: "Your LuminaBridge account is approved",
      text: `Your account has been approved.\n\nLogin ID: ${user.email}\nTemporary Password: ${temporaryPassword}\n\nPlease login and change your password from profile.`,
    });

    await createNotification(
      user.id,
      "Your account has been approved. Check your email for temporary credentials.",
      "account-approved",
      user.id,
    );

    return jsonNoStore({ ok: true, status: "approved" });
  }

  await sql`
    UPDATE users
    SET
      is_approved = FALSE,
      approval_status = 'disapproved',
      approval_note = ${note},
      disapproved_at = NOW()
    WHERE id = ${user.id}
  `;

  await sendEmail({
    to: user.email,
    subject: "Your LuminaBridge account request was not approved",
    text: `Your account request has been disapproved.${note ? `\n\nReason: ${note}` : ""}`,
  });

  await createNotification(
    user.id,
    `Your account request has been disapproved.${note ? ` Reason: ${note}` : ""}`,
    "account-disapproved",
    user.id,
  );

  return jsonNoStore({ ok: true, status: "disapproved" });
}
