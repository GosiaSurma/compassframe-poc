import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { InviteForm } from "./invite-form"
import { NameForm } from "./name-form"

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const { linked } = await searchParams

  const [user, relationships, sentInvites] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, role: true, createdAt: true },
    }),
    prisma.relationship.findMany({
      where: {
        OR: [{ parentId: session.user.id }, { teenId: session.user.id }],
        status: "active",
      },
      include: {
        parent: { select: { name: true, email: true } },
        teen:   { select: { name: true, email: true } },
      },
    }),
    prisma.invite.findMany({
      where: { fromUserId: session.user.id, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  if (!user) redirect("/login")

  const otherRole = user.role === "parent" ? "teen" : "parent"
  const linkedPeople = relationships.map(r =>
    user.role === "parent" ? r.teen : r.parent,
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Profile</h1>

      {linked && (
        <div className="bg-green-50 border border-green-100 text-green-800 text-sm px-4 py-3 rounded-lg mb-6">
          You&apos;re now linked! Start a Reflection together.
        </div>
      )}

      {/* ── User card ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-lg">
            {(user.name ?? user.email ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user.name ?? "—"}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
              {user.role}
            </span>
            <NameForm currentName={user.name} />
          </div>
        </div>
      </section>

      {/* ── Linked people ──────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
          Linked {otherRole}s
        </h2>

        {linkedPeople.length === 0 ? (
          <p className="text-sm text-gray-400">
            No one linked yet. Invite your {otherRole} below.
          </p>
        ) : (
          <ul className="space-y-3">
            {linkedPeople.map((person, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm">
                  {(person.name ?? person.email ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{person.name ?? "—"}</p>
                  <p className="text-xs text-gray-400">{person.email}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Invite form ────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">
          Invite a {otherRole}
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          They must already have a Compassframe account.
        </p>
        <InviteForm otherRole={otherRole} />
      </section>

      {/* ── Pending sent invites ───────────────────────────────────── */}
      {sentInvites.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            Pending invites
          </h2>
          <ul className="space-y-2">
            {sentInvites.map(inv => (
              <li key={inv.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{inv.toEmail}</span>
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  pending
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
