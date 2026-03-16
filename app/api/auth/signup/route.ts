import { sql } from "@/lib/db";
import { badRequest, jsonNoStore, serverError } from "@/lib/api";
import { generateVerificationToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { publishUserEventExternal } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildVerifyUrl(req: Request, token: string) {
  const url = new URL(req.url);
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (url.protocol.replace(":", "") || "https");
  return `${proto}://${host}/api/auth/verify-email?token=${token}`;
}

async function sendVerificationEmail(req: Request, email: string, token: string) {
  const verifyUrl = buildVerifyUrl(req, token);
  await sendEmail({
    to: email,
    subject: "Verify your LuminaBridge account",
    text: `Please verify your email by clicking this link: ${verifyUrl}`,
    html: `<p>Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

function isTransientDbError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeCode = (error as { code?: string }).code;
  return (
    maybeCode === "ETIMEDOUT" ||
    maybeCode === "ECONNRESET" ||
    maybeCode === "EAI_AGAIN"
  );
}

async function withDbRetry<T>(task: () => Promise<T>) {
  try {
    return await task();
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    // One quick retry to absorb short-lived serverless DB wake-up blips.
    await new Promise((resolve) => setTimeout(resolve, 300));
    return task();
  }
}

async function notifyAdminsRefresh() {
  try {
    const admins = await sql<{ id: number }[]>`
      SELECT id::int as id FROM users WHERE role = 'admin'
    `;
    await Promise.all(
      admins.map((a) =>
        publishUserEventExternal(a.id, "refresh", { reason: "new-signup" }),
      ),
    );
  } catch {
    // Best-effort — don't fail signup if realtime push fails
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawEmail = body?.email as string | undefined;
  const email = rawEmail?.trim().toLowerCase();
  const role = body?.role as string | undefined;
  const company_name = (body?.company_name as string | undefined) ?? null;
  const wechat_id = (body?.wechat_id as string | undefined) ?? null;
  const mobile_number = (body?.mobile_number as string | undefined) ?? null;
  const whatsapp_number = (body?.whatsapp_number as string | undefined) ?? null;

  if (!email) return badRequest("email required");
  if (!role) return badRequest("role required");
  if (role !== "buyer" && role !== "factory") {
    return badRequest("Only buyer/factory signup is allowed");
  }

  try {
    const existingUsers = await withDbRetry(() =>
      sql<{
        id: number;
        email: string;
        role: "buyer" | "factory" | "admin";
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
        WHERE email = ${email}
        LIMIT 1
      `,
    );

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];

      if (existing.role === "admin") {
        return badRequest("Admin account already exists for this email");
      }

      if (existing.role !== role) {
        return badRequest(
          `This email is already registered as ${existing.role}. Please use that portal.`,
        );
      }

      if (!existing.email_verified) {
        await withDbRetry(() =>
          sql`
            UPDATE users
            SET
              company_name = ${company_name},
              wechat_id = ${wechat_id},
              mobile_number = ${mobile_number},
              whatsapp_number = ${whatsapp_number},
              approval_status = 'pending_verification',
              is_approved = FALSE
            WHERE id = ${existing.id}
          `,
        );

        await withDbRetry(() =>
          sql`
            UPDATE email_verification_tokens
            SET used_at = NOW()
            WHERE user_id = ${existing.id} AND used_at IS NULL
          `,
        );

        const token = generateVerificationToken();
        await withDbRetry(() =>
          sql`
            INSERT INTO email_verification_tokens (user_id, token, expires_at)
            VALUES (${existing.id}, ${token}, NOW() + INTERVAL '30 minutes')
          `,
        );
        await sendVerificationEmail(req, existing.email, token);
        void notifyAdminsRefresh();

        return jsonNoStore({
          ok: true,
          message:
            "This email is already registered but not verified. A new verification email has been sent.",
        });
      }

      if (existing.approval_status === "pending") {
        return badRequest("Your account is already verified and awaiting admin approval");
      }

      if (existing.approval_status === "disapproved") {
        return badRequest("Your account has been disapproved. Please contact admin.");
      }

      return badRequest("Account already exists. Please sign in.");
    }

    const users = await withDbRetry(() =>
      sql<{
        id: number;
        email: string;
        role: string;
        company_name: string | null;
        wechat_id: string | null;
        mobile_number: string | null;
        whatsapp_number: string | null;
      }[]>`
        INSERT INTO users (email, role, company_name, wechat_id, mobile_number, whatsapp_number)
        VALUES (${email}, ${role}, ${company_name}, ${wechat_id}, ${mobile_number}, ${whatsapp_number})
        RETURNING
          id::int as id,
          email,
          role,
          company_name,
          wechat_id,
          mobile_number,
          whatsapp_number
      `,
    );

    const user = users[0];
    const token = generateVerificationToken();
    await withDbRetry(() =>
      sql`
        INSERT INTO email_verification_tokens (user_id, token, expires_at)
        VALUES (${user.id}, ${token}, NOW() + INTERVAL '30 minutes')
      `,
    );

    await sendVerificationEmail(req, user.email, token);
    void notifyAdminsRefresh();

    return jsonNoStore({
      ok: true,
      message: "Signup successful. Check your email to verify your account.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    if (isTransientDbError(error)) {
      return serverError(
        "Database is temporarily unavailable. Please try again in a few seconds.",
      );
    }
    return badRequest("Unable to process signup right now. Please try again.");
  }
}
