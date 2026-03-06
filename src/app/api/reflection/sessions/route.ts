import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callMI, type MIResponse } from "@/lib/llm"
import { buildOpeningSystemPrompt, getOpeningPrompt } from "@/lib/mi-prompts"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { topic } = await req.json()
  if (!topic?.trim()) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 })
  }

  const topicStr = (topic as string).trim().slice(0, 120)

  const reflectionSession = await prisma.reflectionSession.create({
    data: { userId: session.user.id, topic: topicStr },
  })

  // Generate the opening AI message
  let opening: MIResponse
  try {
    opening = await callMI(
      [{ role: "user", content: getOpeningPrompt(topicStr) }],
      buildOpeningSystemPrompt(topicStr),
      { topic: topicStr, stage: "situation" },
    )
  } catch (err) {
    console.error("[reflection:open]", err)
    opening = {
      reflection_text: `Welcome. You've chosen to reflect on "${topicStr}".`,
      emotion_label: "",
      follow_up_question: "What feels like the right place to start?",
      highlighted_insight: null,
      progress_stage: "situation",
      topic_anchor: topicStr,
      summary_readiness_score: 0,
    }
  }

  await prisma.message.create({
    data: {
      sessionId: reflectionSession.id,
      role: "assistant",
      content: opening.reflection_text,
      emotionLabel: opening.emotion_label || null,
      followUpQuestion: opening.follow_up_question,
      progressStage: opening.progress_stage,
      summaryReadinessScore: opening.summary_readiness_score,
      symbolicMarker: opening.highlighted_insight?.symbolic_marker ?? null,
      insightText: opening.highlighted_insight?.enabled ? opening.highlighted_insight.text : null,
    },
  })

  return NextResponse.json({ sessionId: reflectionSession.id }, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessions = await prisma.reflectionSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true, topic: true, status: true,
      roundCount: true, createdAt: true, updatedAt: true,
    },
  })

  return NextResponse.json(sessions)
}
