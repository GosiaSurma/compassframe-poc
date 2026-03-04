import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const { summaryId, editedText } = await req.json()

  if (!summaryId) {
    return NextResponse.json({ error: "summaryId is required" }, { status: 400 })
  }

  const reflectionSession = await prisma.reflectionSession.findUnique({
    where: { id: sessionId, userId: session.user.id },
  })
  if (!reflectionSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const summary = await prisma.reflectionSummary.findFirst({
    where: { id: summaryId, sessionId },
  })
  if (!summary) {
    return NextResponse.json({ error: "Summary not found" }, { status: 404 })
  }

  const finalText =
    editedText !== undefined && editedText.trim() !== ""
      ? editedText.trim()
      : summary.text

  const isEdited = finalText !== summary.text

  await prisma.$transaction([
    // Deselect all other summaries in this session
    prisma.reflectionSummary.updateMany({
      where: { sessionId, id: { not: summaryId } },
      data: { selected: false },
    }),
    // Mark chosen summary
    prisma.reflectionSummary.update({
      where: { id: summaryId },
      data: { selected: true, edited: isEdited, text: finalText },
    }),
    // Complete the session
    prisma.reflectionSession.update({
      where: { id: sessionId },
      data: { status: "completed" },
    }),
  ])

  return NextResponse.json({ ok: true })
}
