"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Props {
  userName?: string | null
}

type Role = "parent" | "teen"

const ROLES: { value: Role; emoji: string; label: string; desc: string }[] = [
  {
    value: "parent",
    emoji: "🧑‍👧",
    label: "Parent",
    desc: "You want to understand and connect with your teen through reflective conversation.",
  },
  {
    value: "teen",
    emoji: "🧑",
    label: "Teen",
    desc: "You want a safe space to reflect and feel heard by your parent.",
  },
]

export function OnboardingScreen({ userName }: Props) {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstName = userName?.split(" ")[0]

  async function handleContinue() {
    if (!role) return
    setLoading(true)
    setError(null)

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })

    if (!res.ok) {
      setError("Something went wrong. Please try again.")
      setLoading(false)
      return
    }

    // Full navigation refresh so the layout re-reads the session role
    router.push("/reflection")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            {firstName ? `Welcome, ${firstName}!` : "Welcome!"}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            How will you be using Compassframe?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {ROLES.map(({ value, emoji, label, desc }) => (
            <button
              key={value}
              onClick={() => setRole(value)}
              className={cn(
                "p-6 rounded-2xl border-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                role === value
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 bg-white hover:border-brand-200 hover:bg-gray-50",
              )}
            >
              <div className="text-3xl mb-3">{emoji}</div>
              <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg mb-4">
            {error}
          </p>
        )}

        <Button
          onClick={handleContinue}
          disabled={!role}
          loading={loading}
          size="lg"
        >
          {role
            ? `Continue as ${role.charAt(0).toUpperCase() + role.slice(1)}`
            : "Select a role to continue"}
        </Button>

        <p className="text-xs text-center text-gray-400 mt-4">
          You can change this in Settings later.
        </p>
      </div>
    </div>
  )
}
