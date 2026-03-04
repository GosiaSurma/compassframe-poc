import Link from "next/link"

type Status = "success" | "expired" | "invalid" | "pending"

const CONTENT: Record<
  Status,
  { icon: string; color: string; title: string; body: string; link: string; linkLabel: string }
> = {
  success: {
    icon: "✓",
    color: "text-green-500 bg-green-50",
    title: "Email verified!",
    body: "Your account is active. You can now sign in.",
    link: "/login?verified=true",
    linkLabel: "Sign in",
  },
  expired: {
    icon: "⏱",
    color: "text-amber-500 bg-amber-50",
    title: "Link expired",
    body: "This verification link has expired. Please register again to receive a new one.",
    link: "/register",
    linkLabel: "Register again",
  },
  invalid: {
    icon: "✕",
    color: "text-red-500 bg-red-50",
    title: "Invalid link",
    body: "This link is invalid or has already been used.",
    link: "/register",
    linkLabel: "Register again",
  },
  pending: {
    icon: "✉",
    color: "text-brand-500 bg-brand-50",
    title: "Verify your email",
    body: "Check your inbox for a verification link. It expires in 24 hours.",
    link: "/login",
    linkLabel: "Back to sign in",
  },
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { success, error } = await searchParams

  let status: Status = "pending"
  if (success) status = "success"
  else if (error === "expired") status = "expired"
  else if (error) status = "invalid"

  const c = CONTENT[status]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center animate-fade-in">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold ${c.color}`}
        >
          {c.icon}
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{c.title}</h2>
        <p className="text-sm text-gray-500 mb-6">{c.body}</p>
        <Link href={c.link} className="text-sm text-brand-600 hover:underline font-medium">
          {c.linkLabel}
        </Link>
      </div>
    </div>
  )
}
