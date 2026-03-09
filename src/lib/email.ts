import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")
const FROM = process.env.EMAIL_FROM ?? "noreply@compassframe.app"
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

const isDev =
  !process.env.RESEND_API_KEY ||
  process.env.RESEND_API_KEY.startsWith("re_placeholder")

function devLog(label: string, url: string) {
  console.log(`\n╔══════════════════════════════════════════╗`)
  console.log(`║  [EMAIL:${label.padEnd(8)}]                     ║`)
  console.log(`║  ${url}`)
  console.log(`╚══════════════════════════════════════════╝\n`)
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${BASE_URL}/api/auth/verify-email?token=${token}`
  if (isDev) { devLog("VERIFY", url); return }
  await resend.emails.send({
    from: FROM, to: email,
    subject: "Verify your Compassframe email",
    html: verifyTemplate(url),
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${BASE_URL}/reset-password?token=${token}`
  if (isDev) { devLog("RESET", url); return }
  await resend.emails.send({
    from: FROM, to: email,
    subject: "Reset your Compassframe password",
    html: resetTemplate(url),
  })
}

export async function sendInviteEmail(
  toEmail: string,
  fromName: string,
  fromRole: string,
  token: string,
) {
  const url = `${BASE_URL}/invite/${token}`
  const theirRole = fromRole === "parent" ? "teen" : "parent"
  if (isDev) { devLog("INVITE", url); return }
  await resend.emails.send({
    from: FROM, to: toEmail,
    subject: `${fromName} invited you to Compassframe`,
    html: inviteTemplate(url, fromName, theirRole),
  })
}

// ── Templates ──────────────────────────────────────────────────────────

function verifyTemplate(url: string) {
  return base(`
    <h2 style="color:#0f172a;margin:0 0 8px">Verify your email</h2>
    <p style="color:#475569;margin:0 0 20px">Click below to activate your Compassframe account:</p>
    ${cta(url, "Verify email")}
    <p style="color:#94a3b8;font-size:13px;margin-top:20px">Link expires in 24 hours.</p>
  `)
}

function resetTemplate(url: string) {
  return base(`
    <h2 style="color:#0f172a;margin:0 0 8px">Reset your password</h2>
    <p style="color:#475569;margin:0 0 20px">Click below to set a new password:</p>
    ${cta(url, "Reset password")}
    <p style="color:#94a3b8;font-size:13px;margin-top:20px">Link expires in 1 hour.</p>
  `)
}

function inviteTemplate(url: string, fromName: string, role: string) {
  return base(`
    <h2 style="color:#0f172a;margin:0 0 8px">${fromName} invited you</h2>
    <p style="color:#475569;margin:0 0 20px">
      You've been invited to join Compassframe as a <strong>${role}</strong>.
      Click below to accept:
    </p>
    ${cta(url, "Accept invite")}
    <p style="color:#94a3b8;font-size:13px;margin-top:20px">Link expires in 7 days.</p>
  `)
}

function base(inner: string) {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 0">${inner}</div>`
}

function cta(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a>`
}
