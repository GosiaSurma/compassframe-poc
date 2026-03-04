import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateToken, expiresIn } from "@/lib/utils"
import { sendPasswordResetEmail } from "@/lib/email"

// Always returns 200 — never confirm whether an email exists (prevents enumeration)
const OK = NextResponse.json({ message: "If that email exists, a reset link has been sent" })

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (user) {
      // Invalidate any existing unused tokens
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      })

      const token = generateToken()
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt: expiresIn(1) },
      })

      await sendPasswordResetEmail(user.email, token)
    }

    return OK
  } catch (err) {
    console.error("[forgot-password]", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
