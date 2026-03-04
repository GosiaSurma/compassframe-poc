import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Lock } from "lucide-react"
import Link from "next/link"
import { ChallengeClient } from "./challenge-client"

export default async function ChallengePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [completedCount, challenges, latestSession] = await Promise.all([
    prisma.reflectionSession.count({
      where: { userId: session.user.id, status: "completed" },
    }),
    prisma.challenge.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { session: { select: { topic: true } } },
    }),
    prisma.reflectionSession.findFirst({
      where: { userId: session.user.id, status: "completed" },
      orderBy: { updatedAt: "desc" },
      include: {
        summaries: { where: { selected: true }, select: { text: true } },
      },
    }),
  ])

  if (completedCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Challenge is locked</h1>
        <p className="text-sm text-gray-500 max-w-xs mb-6">
          Complete your first Reflection to unlock the Challenge module.
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
    <ChallengeClient
      latestContext={
        latestSession
          ? {
              sessionId: latestSession.id,
              topic: latestSession.topic,
              summaryText: latestSession.summaries[0]?.text ?? null,
            }
          : null
      }
      challenges={challenges.map(c => ({
        id: c.id,
        text: c.text,
        topic: c.session?.topic ?? null,
        completedAt: c.completedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  )
}
