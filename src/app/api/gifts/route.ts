import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { toUserId, sessionId, message } = await req.json()

  if (!toUserId) {
    return NextResponse.json({ error: "toUserId is required" }, { status: 400 })
  }

  // Verify the recipient is a linked user (active relationship)
  const relationship = await prisma.relationship.findFirst({
    where: {
      OR: [
        { parentId: session.user.id, teenId: toUserId },
        { parentId: toUserId, teenId: session.user.id },
      ],
      status: "active",
    },
  })

  if (!relationship) {
    return NextResponse.json(
      { error: "You can only send gifts to linked users" },
      { status: 403 },
    )
  }

  const gift = await prisma.gift.create({
    data: {
      fromUserId: session.user.id,
      toUserId,
      sessionId: sessionId ?? null,
      message: message?.trim() ?? null,
    },
  })

  return NextResponse.json(gift, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const gifts = await prisma.gift.findMany({
    where: { toUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      fromUser: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json(gifts)
}
