import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Lock, Share2, Gift } from "lucide-react"
import Link from "next/link"

export default async function SharePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [completed, sentGifts] = await Promise.all([
    prisma.reflectionSession.count({
      where: { userId: session.user.id, status: "completed" },
    }),
    prisma.gift.findMany({
      where: { fromUserId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        toUser: { select: { name: true, email: true } },
        session: {
          select: {
            topic: true,
            summaries: { where: { selected: true }, select: { text: true } },
          },
        },
      },
    }),
  ])

  if (completed === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Share is locked</h1>
        <p className="text-sm text-gray-500 max-w-xs mb-6">
          Complete your first Reflection to unlock the Share module.
        </p>
        <Link
          href="/reflection"
          className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-brand-700 transition-colors"
        >
          Start a Reflection
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Share2 className="w-5 h-5 text-brand-500" />
        <h1 className="text-xl font-semibold text-gray-900">Shared</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">Reflections you&apos;ve sent to others.</p>

      {sentGifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Gift className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">Nothing shared yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            After a Reflection, choose &ldquo;Share&rdquo; or &ldquo;Convert to Gift&rdquo; to send
            your summary to a linked person.
          </p>
          <Link
            href="/reflection"
            className="mt-5 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Start a Reflection →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {sentGifts.map(gift => (
            <li
              key={gift.id}
              className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {(gift.toUser.name ?? gift.toUser.email)[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {gift.toUser.name ?? gift.toUser.email}
                  </p>
                  <p className="text-xs text-gray-400">
                    {gift.session?.topic ?? "Reflection"} ·{" "}
                    {new Date(gift.createdAt).toLocaleDateString()}
                    {gift.readAt && (
                      <span className="ml-2 text-green-500">✓ Opened</span>
                    )}
                  </p>
                </div>
              </div>

              {gift.session?.summaries[0]?.text && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
                  {gift.session.summaries[0].text}
                </p>
              )}

              {gift.message && (
                <p className="text-xs text-gray-500 italic">&ldquo;{gift.message}&rdquo;</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
