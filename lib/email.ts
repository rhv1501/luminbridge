type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const EMAIL_FROM = process.env.EMAIL_FROM || "LuminaBridge <onboarding@resend.dev>";

export async function sendEmail({ to, subject, text, html }: SendEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    // Local/dev fallback: keep flow working even without SMTP/API setup.
    console.log("[email:fallback]", { to, subject, text });
    return { ok: true, provider: "fallback" as const };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const payload = await res.text().catch(() => "");
    console.error("[email:resend] Failed to send email — HTTP", res.status, payload);
    return { ok: false, provider: "resend" as const };
  }

  return { ok: true, provider: "resend" as const };
}