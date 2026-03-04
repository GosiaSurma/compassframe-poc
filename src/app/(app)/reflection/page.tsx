import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TopicSelector } from "./topic-selector"

export default async function ReflectionPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const recentSessions = await prisma.reflectionSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true, topic: true, status: true,
      roundCount: true, updatedAt: true,
    },
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Reflection</h1>
      <p className="text-sm text-gray-500 mb-8">Choose something to explore.</p>
      <TopicSelector recentSessions={recentSessions} />
    </div>
  )
}
