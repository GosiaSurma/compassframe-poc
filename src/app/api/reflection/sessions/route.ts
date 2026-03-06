import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callMI } from "@/lib/llm"
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
  let opening: { content: string; emotionLabel: string | null; insight: string | null }
  try {
    opening = await callMI(
      [{ role: "user", content: getOpeningPrompt(topicStr) }],
      buildOpeningSystemPrompt(topicStr),
    )
  } catch (err) {
    console.error("[reflection:open]", err)
    opening = {
      content:
        `Welcome. I'm here to explore alongside you. You've chosen to reflect on "${topicStr}" — what feels like the right place to start?`,
      emotionLabel: null,
      insight: null,
    }
  }

  await prisma.message.create({
    data: {
      sessionId: reflectionSession.id,
      role: "assistant",
      content: opening.content,
      emotionLabel: opening.emotionLabel,
      insightText: opening.insight,
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
