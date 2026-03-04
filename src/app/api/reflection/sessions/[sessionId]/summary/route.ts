import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callSummary } from "@/lib/llm"

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
  if (existing.length > 0) {
    return NextResponse.json(existing)
  }

  // Build plain-text transcript (exclude the synthetic "opening" assistant message if desired)
  const conversation = reflectionSession.messages
    .map(m => `${m.role === "user" ? "Person" : "Companion"}: ${m.content}`)
    .join("\n\n")

  const { summaries: texts } = await callSummary(conversation)

  const created = await prisma.$transaction(
    texts.map(text =>
      prisma.reflectionSummary.create({ data: { sessionId, text } }),
    ),
  )

  return NextResponse.json(created, { status: 201 })
}
