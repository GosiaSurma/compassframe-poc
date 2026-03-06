import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Chat } from "./chat"
import type { MessageData } from "@/components/reflection/ChatBubble"

export default async function ReflectionSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const { sessionId } = await params

  const [reflectionSession, user] = await Promise.all([
    prisma.reflectionSession.findUnique({
      where: { id: sessionId, userId: session.user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { magicalMode: true },
    }),
  ])

  if (!reflectionSession) notFound()

  const messages: MessageData[] = reflectionSession.messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    followUpQuestion: m.followUpQuestion,
    insightText: m.insightText,
    insightResponse: m.insightResponse,
    emotionLabel: m.emotionLabel,
    progressStage: m.progressStage,
    symbolicMarker: m.symbolicMarker,
    summaryReadinessScore: m.summaryReadinessScore,
  }))

  return (
    <Chat
      session={{
        id: reflectionSession.id,
        topic: reflectionSession.topic,
        status: reflectionSession.status,
        roundCount: reflectionSession.roundCount,
      }}
      initialMessages={messages}
      magicalMode={user?.magicalMode ?? "off"}
    />
  )
}
