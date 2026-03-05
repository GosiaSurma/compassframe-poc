import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AcceptInviteButton } from "./accept-button"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const session = await getServerSession(authOptions)

  // Not logged in — send to login and come back
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`)
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { fromUser: { select: { name: true, email: true, role: true } } },
  })

  // ── Error states ──────────────────────────────────────────────────

  if (!invite) {
    return <InviteCard icon="✕" title="Invalid link" body="This invite link doesn't exist." />
  }

  if (invite.status !== "pending") {
    return (
      <InviteCard
        icon="✓"
        title="Already used"
        body="This invite has already been accepted."
        linkHref="/profile"
        linkLabel="Go to Profile"
      />
    )
  }

  if (invite.expiresAt < new Date()) {
    return (
      <InviteCard
        icon="⏱"
        title="Invite expired"
        body="Ask the sender to resend the invite."
        linkHref="/profile"
        linkLabel="Go to Profile"
      />
    )
  }

  if (invite.fromUserId === session.user.id) {
    return (
      <InviteCard
        icon="👋"
        title="Your own invite"
        body="Share this link with the person you want to link with."
        linkHref="/profile"
        linkLabel="Go to Profile"
      />
    )
  }

  const fromName = invite.fromUser.name ?? invite.fromUser.email ?? "Someone"
  const fromRole = invite.fromUser.role ?? "unknown"
  const expectedRole = fromRole === "parent" ? "teen" : "parent"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-5xl mb-4">🤝</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          {fromName} invited you
        </h1>
        <p className="text-sm text-gray-500 mb-1">
          They&apos;re joining as a <span className="font-medium capitalize">{fromRole}</span>.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          You would join as a <span className="font-medium capitalize">{expectedRole}</span>.
        </p>

        {session.user.role && session.user.role !== expectedRole ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg mb-4">
            Your account is set to <strong>{session.user.role}</strong>, but this invite expects
            a <strong>{expectedRole}</strong>. Update your role in Settings first.
          </p>
        ) : null}

        {!session.user.role ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg mb-4">
            Complete your{" "}
            <a href="/onboarding/role" className="underline font-medium">role setup</a>
            {" "}before accepting this invite.
          </p>
        ) : null}

        <AcceptInviteButton
          token={token}
          disabled={!session.user.role || session.user.role !== expectedRole}
        />
      </div>
    </div>
  )
}

function InviteCard({
  icon,
  title,
  body,
  linkHref,
  linkLabel,
}: {
  icon: string
  title: string
  body: string
  linkHref?: string
  linkLabel?: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-4">{icon}</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{body}</p>
        {linkHref && (
          <a href={linkHref} className="text-sm text-brand-600 hover:underline font-medium">
            {linkLabel}
          </a>
        )}
      </div>
    </div>
  )
}
