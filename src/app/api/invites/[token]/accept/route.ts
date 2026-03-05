import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { token } = await params

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { fromUser: { select: { id: true, name: true, role: true } } },
  })

  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "Invalid or already-used invite" }, { status: 400 })
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 400 })
  }
  if (invite.fromUserId === session.user.id) {
    return NextResponse.json({ error: "You can't accept your own invite" }, { status: 400 })
  }

  const acceptingUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  const fromRole = invite.fromUser.role
  const toRole = acceptingUser?.role

  if (!toRole) {
    return NextResponse.json({ error: "Complete your role onboarding first" }, { status: 400 })
  }

  const compatible =
    (fromRole === "parent" && toRole === "teen") ||
    (fromRole === "teen"   && toRole === "parent")

  if (!compatible) {
    return NextResponse.json(
      { error: `Role mismatch: sender is "${fromRole}", you are "${toRole}"` },
      { status: 409 },
    )
  }

  const parentId = fromRole === "parent" ? invite.fromUserId : session.user.id
  const teenId   = fromRole === "teen"   ? invite.fromUserId : session.user.id

  // Enforce: teen can have at most 2 active parents
  const parentCount = await prisma.relationship.count({
    where: { teenId, status: "active" },
  })
  if (parentCount >= 2) {
    return NextResponse.json(
      { error: "A teen can be linked to at most 2 parents." },
      { status: 409 },
    )
  }

  await prisma.$transaction([
    prisma.relationship.upsert({
      where: { parentId_teenId: { parentId, teenId } },
      create: { parentId, teenId, status: "active" },
      update: { status: "active" },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { status: "accepted" },
    }),
  ])

  return NextResponse.json({ message: "Invite accepted", parentId, teenId })
}
