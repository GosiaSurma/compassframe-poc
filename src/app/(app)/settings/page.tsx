import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SettingsForm } from "./form"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [user, relationships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, magicalMode: true },
    }),
    prisma.relationship.findMany({
      where: {
        OR: [{ parentId: session.user.id }, { teenId: session.user.id }],
        status: "active",
      },
      include: {
        parent: { select: { id: true, name: true, email: true } },
        teen:   { select: { id: true, name: true, email: true } },
      },
    }),
  ])

  if (!user) redirect("/login")

  const connections = relationships.map(r => ({
    id: r.id,
    other: session.user.id === r.parentId ? r.teen : r.parent,
    otherRole: session.user.id === r.parentId ? "teen" : "parent",
  }))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Settings</h1>
      <SettingsForm
        currentRole={(user.role ?? "parent") as "parent" | "teen"}
        currentMagicalMode={user.magicalMode}
        connections={connections}
      />
    </div>
  )
}
