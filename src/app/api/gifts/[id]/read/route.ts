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

  const gift = await prisma.gift.findFirst({
    where: { id, toUserId: session.user.id },
  })
  if (!gift) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (gift.readAt) return NextResponse.json({ ok: true }) // already read

  await prisma.gift.update({
    where: { id },
    data: { readAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
