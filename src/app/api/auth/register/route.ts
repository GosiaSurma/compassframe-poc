import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { generateToken, expiresIn } from "@/lib/utils"
import { sendVerificationEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, password } = body as {
      name?: string
      email?: string
      password?: string
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const normalEmail = email.toLowerCase().trim()

    const existing = await prisma.user.findUnique({ where: { email: normalEmail } })
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name: name?.trim() || null,
        email: normalEmail,
        passwordHash,
      },
    })

    const token = generateToken()
    await prisma.emailVerifyToken.create({
      data: { userId: user.id, token, expiresAt: expiresIn(24) },
    })

    await sendVerificationEmail(normalEmail, token)

    return NextResponse.json(
      { message: "Check your email to verify your account" },
      { status: 201 },
    )
  } catch (err) {
    console.error("[register]", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
