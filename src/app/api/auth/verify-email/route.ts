import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  const token = new URL(req.url).searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(`${origin}/verify-email?error=missing`)
  }

  const record = await prisma.emailVerifyToken.findUnique({ where: { token } })

  if (!record || record.used) {
    return NextResponse.redirect(`${origin}/verify-email?error=invalid`)
  }
  if (record.expiresAt < new Date()) {
    return NextResponse.redirect(`${origin}/verify-email?error=expired`)
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerifyToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
  ])

  return NextResponse.redirect(`${origin}/verify-email?success=true`)
}
