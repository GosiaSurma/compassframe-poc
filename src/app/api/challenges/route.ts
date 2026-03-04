import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const challenges = await prisma.challenge.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      session: { select: { topic: true } },
    },
  })

  return NextResponse.json(challenges)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { text, sessionId } = await req.json()

  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 })
  }

  // Verify sessionId belongs to this user (if provided)
  if (sessionId) {
    const rs = await prisma.reflectionSession.findFirst({
      where: { id: sessionId, userId: session.user.id, status: "completed" },
    })
    if (!rs) return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const challenge = await prisma.challenge.create({
    data: {
      userId: session.user.id,
      sessionId: sessionId ?? null,
      text: text.trim(),
    },
    include: { session: { select: { topic: true } } },
  })

  return NextResponse.json(challenge, { status: 201 })
}
