import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const VALID_RESPONSES = ["resonates", "not_quite", "clarify"] as const

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string; messageId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId, messageId } = await params
  const { insightResponse } = await req.json()

  if (!VALID_RESPONSES.includes(insightResponse)) {
    return NextResponse.json({ error: "Invalid insight response" }, { status: 400 })
  }

  // Verify ownership: the message must belong to a session owned by this user
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      sessionId,
      session: { userId: session.user.id },
    },
  })

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 })
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { insightResponse },
  })

  return NextResponse.json(updated)
}
