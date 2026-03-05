"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface Props {
  otherRole: string
}

export function ConnectForm({ otherRole }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSend() {
    if (!email.trim()) return
    setSending(true)
    setError(null)

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toEmail: email.trim() }),
    })

    const data = await res.json()
    setSending(false)

    if (!res.ok) {
      setError(data.error ?? "Failed to send invite")
      return
    }

    setInviteLink(data.inviteLink)
  }

  async function handleCopy() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inviteLink) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
            ✓
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Invite sent to {email}</p>
            <p className="text-xs text-gray-400">
              They&apos;ll receive an email. You can also copy the link below.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-100 px-3 py-2 flex items-center gap-2">
          <p className="text-xs text-gray-500 flex-1 truncate">{inviteLink}</p>
          <button
            onClick={handleCopy}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <Button size="lg" onClick={() => router.push("/reflection")}>
          Continue to app →
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {otherRole === "teen" ? "Teen" : "Parent"}&apos;s email address
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder={`${otherRole}@example.com`}
          autoFocus
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <Button
        size="lg"
        onClick={handleSend}
        disabled={!email.trim()}
        loading={sending}
      >
        Send invite
      </Button>

      <button
        onClick={() => router.push("/reflection")}
        className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors text-center py-1"
      >
        Skip for now →
      </button>
    </div>
  )
}
