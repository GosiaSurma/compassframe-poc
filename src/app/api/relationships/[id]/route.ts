import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const relationship = await prisma.relationship.findFirst({
    where: {
      id,
      OR: [
        { parentId: session.user.id },
        { teenId: session.user.id },
      ],
      status: "active",
    },
  })

  if (!relationship) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 })
  }

  await prisma.relationship.update({
    where: { id },
    data: { status: "removed" },
  })

  return NextResponse.json({ ok: true })
}
