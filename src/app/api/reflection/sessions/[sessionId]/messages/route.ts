import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callMI } from "@/lib/llm"
import { buildMISystemPrompt, getBand, getOpeningPrompt } from "@/lib/mi-prompts"

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

  const assistantMessages = reflectionSession.messages.filter(m => m.role === "assistant")

  // Anti-repetition context
  const usedEmotions = assistantMessages
    .map(m => m.emotionLabel)
    .filter((e): e is string => e !== null && e !== "")
  const priorInsights = assistantMessages
    .map(m => m.insightText)
    .filter((i): i is string => i !== null && i !== "")
  const lastAssistant = assistantMessages[assistantMessages.length - 1]
  const priorQuestion = lastAssistant?.followUpQuestion ?? null

  const nextRound = reflectionSession.roundCount + 1
  const stage = getBand(nextRound)

  // Build LLM history: topic-specific opening, then stored messages, then new user message
  const history: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: getOpeningPrompt(reflectionSession.topic) },
    ...reflectionSession.messages.map(m => ({
      role: m.role as "user" | "assistant",
      // Reconstruct assistant turns as they appeared: reflection + question combined
      content:
        m.role === "assistant" && m.followUpQuestion
          ? `${m.content}\n\n${m.followUpQuestion}`
          : m.content,
    })),
    { role: "user", content: content.trim() },
  ]

  // Persist user message first so it's never lost
  const userMessage = await prisma.message.create({
    data: { sessionId, role: "user", content: content.trim() },
  })

  // Call LLM with round-aware prompt
  let aiResponse
  try {
    aiResponse = await callMI(
      history,
      buildMISystemPrompt({
        topic: reflectionSession.topic,
        round: nextRound,
        usedEmotions,
        priorInsights,
        priorQuestion,
      }),
      { topic: reflectionSession.topic, stage },
    )
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
      content: aiResponse.reflection_text,
      emotionLabel: aiResponse.emotion_label || null,
      followUpQuestion: aiResponse.follow_up_question,
      progressStage: aiResponse.progress_stage,
      summaryReadinessScore: aiResponse.summary_readiness_score,
      symbolicMarker: aiResponse.highlighted_insight?.symbolic_marker ?? null,
      insightText: aiResponse.highlighted_insight?.enabled
        ? aiResponse.highlighted_insight.text
        : null,
    },
  })

  const newRoundCount = reflectionSession.roundCount + 1
  await prisma.reflectionSession.update({
    where: { id: sessionId },
    data: { roundCount: newRoundCount },
  })

  return NextResponse.json({ userMessage, assistantMessage, roundCount: newRoundCount })
}
