import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const VALID_MODES = ["off", "light", "full"] as const
const VALID_ROLES = ["parent", "teen"] as const

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, string> = {}

  if (body.magicalMode !== undefined) {
    if (!VALID_MODES.includes(body.magicalMode)) {
      return NextResponse.json({ error: "Invalid magical mode" }, { status: 400 })
    }
    updates.magicalMode = body.magicalMode
  }

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Role must be 'parent' or 'teen'" }, { status: 400 })
    }
    updates.role = body.role
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updates,
    select: { role: true, magicalMode: true },
  })

  return NextResponse.json(user)
}
