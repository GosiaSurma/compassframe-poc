import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AppNav } from "@/components/nav/AppNav"
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // No role yet — render onboarding fullscreen inside this layout.
  // This avoids a redirect loop (onboarding page is inside this group).
  if (!session.user.role) {
    return <OnboardingScreen userName={session.user.name} />
  }

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
