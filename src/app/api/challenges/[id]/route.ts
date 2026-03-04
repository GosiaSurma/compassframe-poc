import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const challenge = await prisma.challenge.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.challenge.update({
    where: { id },
    data: {
      completedAt: challenge.completedAt ? null : new Date(),
    },
    include: { session: { select: { topic: true } } },
  })

  return NextResponse.json(updated)
}
