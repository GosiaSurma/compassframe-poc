import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callSummary } from "@/lib/llm"
import { SummaryClient } from "./summary-client"

export default async function SummaryPage({
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
      select: { role: true },
    }),
  ])

  if (!reflectionSession) notFound()

  // ── Generate summaries if not yet done ─────────────────────────
  let summaries = await prisma.reflectionSummary.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  })

  if (summaries.length === 0) {
    const conversation = reflectionSession.messages
      .map(m => `${m.role === "user" ? "Person" : "Companion"}: ${m.content}`)
      .join("\n\n")

    const { summaries: texts } = await callSummary(conversation)

    summaries = await prisma.$transaction(
      texts.map(text => prisma.reflectionSummary.create({ data: { sessionId, text } })),
    )
  }

  // ── Fetch linked users for sharing / gifting ───────────────────
  const relationships = await prisma.relationship.findMany({
    where: {
      OR: [
        { parentId: session.user.id },
        { teenId: session.user.id },
      ],
      status: "active",
    },
    include: {
      parent: { select: { id: true, name: true, email: true } },
      teen:   { select: { id: true, name: true, email: true } },
    },
  })

  const linkedUsers = relationships.map(r =>
    user?.role === "parent" ? r.teen : r.parent,
  )

  return (
    <SummaryClient
      sessionId={sessionId}
      topic={reflectionSession.topic}
      roundCount={reflectionSession.roundCount}
      alreadyCompleted={reflectionSession.status === "completed"}
      summaries={summaries.map(s => ({
        id: s.id,
        text: s.text,
        selected: s.selected,
        edited: s.edited,
      }))}
      linkedUsers={linkedUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }))}
    />
  )
}
