import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AppNav } from "@/components/nav/AppNav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // No role yet — send to dedicated onboarding route (outside this group)
  if (!session.user.role) redirect("/onboarding/role")

  const [completedCount, unreadGiftCount] = await Promise.all([
    prisma.reflectionSession.count({
      where: { userId: session.user.id, status: "completed" },
    }),
    prisma.gift.count({
      where: { toUserId: session.user.id, readAt: null },
    }),
  ])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AppNav
        userName={session.user.name ?? session.user.email ?? ""}
        userRole={session.user.role}
        hasCompletedReflection={completedCount > 0}
        unreadGiftCount={unreadGiftCount}
      />
      {/* pb-16 makes room for the mobile bottom bar */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
