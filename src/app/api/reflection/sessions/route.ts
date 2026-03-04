import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callMI } from "@/lib/llm"
import { getMISystemPrompt, getOpeningPrompt } from "@/lib/mi-prompts"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { topic } = await req.json()
  if (!topic?.trim()) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 })
  }

  const topicStr = topic.trim() as string

  const reflectionSession = await prisma.reflectionSession.create({
    data: { userId: session.user.id, topic: topicStr },
  })

  // Generate the opening AI message
  let opening: { content: string; insight: string | null }
  try {
    opening = await callMI(
      [{ role: "user", content: getOpeningPrompt() }],
      getMISystemPrompt(topicStr),
    )
  } catch (err) {
    console.error("[reflection:open]", err)
    opening = {
      content:
        "Welcome. I'm here to listen and explore alongside you. What's been on your mind lately about this topic?",
      insight: null,
    }
  }

  await prisma.message.create({
    data: {
      sessionId: reflectionSession.id,
      role: "assistant",
      content: opening.content,
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
