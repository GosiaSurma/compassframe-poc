import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { ConnectForm } from "./connect-form"

export default async function OnboardingConnectPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (!session.user.role) redirect("/onboarding/role")

  const otherRole = session.user.role === "parent" ? "teen" : "parent"

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔗</div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Link with your {otherRole}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Enter their email to send an invite link. They don&apos;t need an account yet.
          </p>
        </div>

        <ConnectForm otherRole={otherRole} />
      </div>
    </div>
  )
}
