import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen"

export default async function OnboardingRolePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // Already has a role — skip onboarding
  if (session.user.role) redirect("/reflection")

  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingScreen userName={session.user.name} />
    </div>
  )
}
