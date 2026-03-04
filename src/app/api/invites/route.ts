import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateToken, expiresIn } from "@/lib/utils"
import { sendInviteEmail } from "@/lib/email"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { toEmail } = await req.json()
  if (!toEmail) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const normalEmail = toEmail.toLowerCase().trim()

  // Can't invite yourself
  if (normalEmail === session.user.email?.toLowerCase()) {
    return NextResponse.json({ error: "You can't invite yourself" }, { status: 400 })
  }

  const fromUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: true },
  })
  if (!fromUser?.role) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 })
  }

  const expectedRole = fromUser.role === "parent" ? "teen" : "parent"

  // Check if recipient has an account with the correct role
  const toUser = await prisma.user.findUnique({
    where: { email: normalEmail },
    select: { id: true, role: true },
  })

  if (!toUser) {
    return NextResponse.json(
      { error: `No account found for ${normalEmail}. They need to register first.` },
      { status: 404 },
    )
  }

  if (toUser.role && toUser.role !== expectedRole) {
    return NextResponse.json(
      { error: `${normalEmail} has the role "${toUser.role}" but you need a ${expectedRole}.` },
      { status: 409 },
    )
  }

  // No existing active relationship
  const existingRel = await prisma.relationship.findFirst({
    where: {
      OR: [
        { parentId: session.user.id, teenId: toUser.id },
        { parentId: toUser.id, teenId: session.user.id },
      ],
      status: "active",
    },
  })
  if (existingRel) {
    return NextResponse.json({ error: "You are already linked with this person" }, { status: 409 })
  }

  // Invalidate any pending invites to the same email from this user
  await prisma.invite.updateMany({
    where: { fromUserId: session.user.id, toEmail: normalEmail, status: "pending" },
    data: { status: "expired" },
  })

  const token = generateToken()
  await prisma.invite.create({
    data: {
      fromUserId: session.user.id,
      toEmail: normalEmail,
      token,
      expiresAt: expiresIn(7 * 24), // 7 days
    },
  })

  const fromName = fromUser.name ?? fromUser.email ?? "Someone"
  await sendInviteEmail(normalEmail, fromName, fromUser.role, token)

  return NextResponse.json({ message: `Invite sent to ${normalEmail}` }, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const invites = await prisma.invite.findMany({
    where: { fromUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, toEmail: true, status: true, createdAt: true, expiresAt: true },
  })

  return NextResponse.json(invites)
}
