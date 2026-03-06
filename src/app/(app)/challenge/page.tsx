import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Lock } from "lucide-react"
import Link from "next/link"
import { callChallengeSuggestions } from "@/lib/llm"
import { ChallengeClient } from "./challenge-client"

export default async function ChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const { from } = await searchParams

  const [completedCount, challenges] = await Promise.all([
    prisma.reflectionSession.count({
      where: { userId: session.user.id, status: "completed" },
    }),
    prisma.challenge.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { session: { select: { topic: true } } },
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

  // ── Load context session ──────────────────────────────────────────────────
  // If `from` is set (coming via Proceed), use that specific session and generate
  // suggestions. Otherwise fall back to the latest completed session (no suggestions).

  let contextSession: {
    id: string
    topic: string
    summaryText: string | null
    emotionalTheme: string | null
    finalUserTurns: string[]
  } | null = null

  let suggestions: string[] = []

  if (from) {
    const fromSession = await prisma.reflectionSession.findUnique({
      where: { id: from, userId: session.user.id, status: "completed" },
      include: {
        summaries: { where: { selected: true }, select: { text: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true, emotionLabel: true },
        },
      },
    })

    if (fromSession) {
      const summaryText = fromSession.summaries[0]?.text ?? null

      // First detected emotional theme
      const emotionalTheme =
        fromSession.messages
          .filter(m => m.role === "assistant" && m.emotionLabel)
          .map(m => m.emotionLabel!)[0] ?? null

      // Last 3 user turns
      const finalUserTurns = fromSession.messages
        .filter(m => m.role === "user")
        .slice(-3)
        .map(m => m.content)

      contextSession = {
        id: fromSession.id,
        topic: fromSession.topic,
        summaryText,
        emotionalTheme,
        finalUserTurns,
      }

      if (summaryText) {
        try {
          const result = await callChallengeSuggestions({
            topic: fromSession.topic,
            summaryText,
            emotionalTheme,
            finalUserTurns,
          })
          suggestions = result.suggestions
        } catch (err) {
          console.error("[challenge:suggest]", err)
          // Suggestions are optional — page still renders without them
        }
      }
    }
  }

  // Fallback: latest completed session (no suggestions)
  if (!contextSession) {
    const latestSession = await prisma.reflectionSession.findFirst({
      where: { userId: session.user.id, status: "completed" },
      orderBy: { updatedAt: "desc" },
      include: {
        summaries: { where: { selected: true }, select: { text: true } },
      },
    })
    if (latestSession) {
      contextSession = {
        id: latestSession.id,
        topic: latestSession.topic,
        summaryText: latestSession.summaries[0]?.text ?? null,
        emotionalTheme: null,
        finalUserTurns: [],
      }
    }
  }

  return (
    <ChallengeClient
      latestContext={
        contextSession
          ? {
              sessionId: contextSession.id,
              topic: contextSession.topic,
              summaryText: contextSession.summaryText,
              emotionalTheme: contextSession.emotionalTheme,
              suggestions,
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
