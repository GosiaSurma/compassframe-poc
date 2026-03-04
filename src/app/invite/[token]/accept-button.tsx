"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function AcceptInviteButton({
  token,
  disabled,
}: {
  token: string
  disabled: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? "Something went wrong")
      return
    }

    router.push("/profile?linked=true")
    router.refresh()
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg mb-4">
          {error}
        </p>
      )}
      <Button onClick={handleAccept} loading={loading} disabled={disabled} size="lg">
        Accept invite
      </Button>
    </div>
  )
}
