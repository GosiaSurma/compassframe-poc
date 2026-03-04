import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const VALID_ROLES = ["parent", "teen"] as const

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { role } = await req.json()

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Role must be 'parent' or 'teen'" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role },
  })

  return NextResponse.json({ role })
}
