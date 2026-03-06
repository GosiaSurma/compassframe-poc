import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callSummary, type SummaryContext } from "@/lib/llm"

/** GET — return existing summaries for a session. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params

  const summaries = await prisma.reflectionSummary.findMany({
    where: { sessionId, session: { userId: session.user.id } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(summaries)
}

/**
 * POST — generate and store 3 summaries from the conversation.
 * If summaries already exist, returns them without re-generating.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params

  const reflectionSession = await prisma.reflectionSession.findUnique({
    where: { id: sessionId, userId: session.user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })

  if (!reflectionSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // Idempotent — reuse existing summaries
  const existing = await prisma.reflectionSummary.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  })
  if (existing.length > 0) return NextResponse.json(existing)

  const msgs = reflectionSession.messages

  const conversationLines = msgs.map(m => {
    if (m.role === "user") return `Person: ${m.content}`
    const parts = [m.content]
    if (m.followUpQuestion) parts.push(m.followUpQuestion)
    return `Companion: ${parts.join("\n")}`
  })

  const emotionalThemes = Array.from(
    new Set(
      msgs
        .filter(m => m.role === "assistant" && m.emotionLabel)
        .map(m => m.emotionLabel!),
    ),
  )

  const acceptedInsights = msgs
    .filter(m => m.insightResponse === "resonates" && m.insightText)
    .map(m => m.insightText!)

  const clarifiedInsights = msgs
    .filter(m => m.insightResponse === "clarify" && m.insightText)
    .map(m => m.insightText!)

  const finalUserTurns = msgs
    .filter(m => m.role === "user")
    .slice(-3)
    .map(m => m.content)

  const summaryCtx: SummaryContext = {
    topic: reflectionSession.topic,
    roundCount: reflectionSession.roundCount,
    conversationLines,
    emotionalThemes,
    acceptedInsights,
    clarifiedInsights,
    finalUserTurns,
  }

  const { summaries: texts } = await callSummary(summaryCtx)

  const created = await prisma.$transaction(
    texts.map(text => prisma.reflectionSummary.create({ data: { sessionId, text } })),
  )

  return NextResponse.json(created, { status: 201 })
}
