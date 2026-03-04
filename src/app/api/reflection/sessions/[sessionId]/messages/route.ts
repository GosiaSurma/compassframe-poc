import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callMI } from "@/lib/llm"
import { getMISystemPrompt, getOpeningPrompt } from "@/lib/mi-prompts"

const MAX_ROUNDS = 12

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const { content } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: "Message content required" }, { status: 400 })
  }

  const reflectionSession = await prisma.reflectionSession.findUnique({
    where: { id: sessionId, userId: session.user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })

  if (!reflectionSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }
  if (reflectionSession.status === "completed") {
    return NextResponse.json({ error: "Session is already complete" }, { status: 400 })
  }
  if (reflectionSession.roundCount >= MAX_ROUNDS) {
    return NextResponse.json({ error: "Maximum rounds reached" }, { status: 400 })
  }

  // Build LLM history: synthetic "Begin." first, then all stored messages, then new message
  const history: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: getOpeningPrompt() },
    ...reflectionSession.messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: content.trim() },
  ]

  // Persist user message first so it's never lost
  const userMessage = await prisma.message.create({
    data: { sessionId, role: "user", content: content.trim() },
  })

  // Call LLM
  let aiResponse: { content: string; insight: string | null }
  try {
    aiResponse = await callMI(history, getMISystemPrompt(reflectionSession.topic))
  } catch (err) {
    console.error("[reflection:message]", err)
    return NextResponse.json(
      { error: "The AI response failed. Please try again." },
      { status: 503 },
    )
  }

  const assistantMessage = await prisma.message.create({
    data: {
      sessionId,
      role: "assistant",
      content: aiResponse.content,
      insightText: aiResponse.insight,
    },
  })

  const newRoundCount = reflectionSession.roundCount + 1
  await prisma.reflectionSession.update({
    where: { id: sessionId },
    data: { roundCount: newRoundCount },
  })

  return NextResponse.json({ userMessage, assistantMessage, roundCount: newRoundCount })
}
