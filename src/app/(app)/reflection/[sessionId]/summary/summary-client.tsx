"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SummaryOption {
  id: string
  text: string
  selected: boolean
  edited: boolean
}

interface LinkedUser {
  id: string
  name: string | null
  email: string
}

interface Props {
  sessionId: string
  topic: string
  roundCount: number
  alreadyCompleted: boolean
  summaries: SummaryOption[]
  linkedUsers: LinkedUser[]
}

type ActionPhase = "idle" | "sharing" | "gifting"

const MAX_ROUNDS = 12

export function SummaryClient({
  sessionId,
  topic,
  roundCount,
  alreadyCompleted,
  summaries: initialSummaries,
  linkedUsers,
}: Props) {
  const router = useRouter()

  const [summaries, setSummaries] = useState(initialSummaries)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialSummaries.find(s => s.selected)?.id ?? null,
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  const [phase, setPhase] = useState<ActionPhase>("idle")
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const [giftMessage, setGiftMessage] = useState("")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // ── Helpers ─────────────────────────────────────────────────────

  const selectedSummary = summaries.find(s => s.id === selectedId)

  function selectSummary(id: string) {
    if (editingId) commitEdit()
    setSelectedId(id)
  }

  function startEdit(id: string) {
    const s = summaries.find(x => x.id === id)
    if (!s) return
    setEditingId(id)
    setEditText(s.text)
  }

  function commitEdit() {
    if (!editingId) return
    const trimmed = editText.trim()
    if (trimmed) {
      setSummaries(prev =>
        prev.map(s => (s.id === editingId ? { ...s, text: trimmed, edited: true } : s)),
      )
    }
    setEditingId(null)
  }

  // ── API calls ────────────────────────────────────────────────────

  async function completeSession(summaryId: string, editedText?: string): Promise<boolean> {
    const res = await fetch(`/api/reflection/sessions/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summaryId, editedText }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to save")
      return false
    }
    return true
  }

  async function createGift(toUserId: string, message?: string): Promise<boolean> {
    const res = await fetch("/api/gifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId, sessionId, message }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to send gift")
      return false
    }
    return true
  }

  // ── Post-actions ─────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    if (editingId) commitEdit()
    const editedText = summaries.find(s => s.id === selectedId)?.text
    const ok = await completeSession(selectedId, editedText)
    setSaving(false)
    if (ok) router.push("/reflection")
  }

  async function handleProceed() {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    if (editingId) commitEdit()
    const editedText = summaries.find(s => s.id === selectedId)?.text
    const ok = await completeSession(selectedId, editedText)
    setSaving(false)
    if (ok) router.push("/challenge")
  }

  async function handleShareOrGift() {
    if (!selectedId || !recipientId) return
    setSaving(true)
    setError(null)
    if (editingId) commitEdit()
    const editedText = summaries.find(s => s.id === selectedId)?.text

    const [completeOk, giftOk] = await Promise.all([
      completeSession(selectedId, editedText),
      createGift(recipientId, giftMessage || undefined),
    ])

    setSaving(false)
    if (completeOk && giftOk) {
      setDone(true)
      setTimeout(() => router.push(phase === "gifting" ? "/gifts" : "/reflection"), 1500)
    }
  }

  // ── Done state ────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {phase === "gifting" ? "Gift sent!" : "Reflection shared!"}
        </h2>
        <p className="text-sm text-gray-500">Redirecting…</p>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.push(`/reflection/${sessionId}`)}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-xl font-semibold text-gray-900 mb-1">Your Reflection</h1>
      <p className="text-sm text-gray-500 mb-2">{topic}</p>
      {alreadyCompleted && (
        <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full mb-4">
          Completed
        </span>
      )}

      <p className="text-sm text-gray-500 mb-6">
        Choose the summary that feels most true, or edit it to say it your way.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg mb-4">
          {error}
        </p>
      )}

      {/* ── Summary cards ─────────────────────────────────────── */}
      <div className="space-y-3 mb-8">
        {summaries.map((s, i) => {
          const isSelected = selectedId === s.id
          const isEditingThis = editingId === s.id

          return (
            <div
              key={s.id}
              onClick={() => !isEditingThis && selectSummary(s.id)}
              className={cn(
                "rounded-2xl border-2 p-5 transition-all cursor-pointer",
                isSelected
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-100 bg-white hover:border-brand-200",
              )}
            >
              <div className="flex items-start gap-3">
                {/* Radio indicator */}
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center",
                    isSelected ? "border-brand-500 bg-brand-500" : "border-gray-300",
                  )}
                >
                  {isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1">Option {i + 1}</p>

                  {isEditingThis ? (
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                      rows={3}
                      className="w-full text-sm text-gray-800 bg-white border border-brand-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  ) : (
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {s.text}
                      {s.edited && (
                        <span className="ml-2 text-xs text-brand-500">(edited)</span>
                      )}
                    </p>
                  )}

                  {isSelected && (
                    <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                      {isEditingThis ? (
                        <button
                          onClick={commitEdit}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                        >
                          ✓ Done editing
                        </button>
                      ) : (
                        <button
                          onClick={() => startEdit(s.id)}
                          className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
                        >
                          ✏ Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Action section (only when a summary is selected) ───── */}
      {selectedId && phase === "idle" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">
            What would you like to do?
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
              Save
            </Button>
            <Button variant="secondary" size="md" onClick={handleProceed} loading={saving}>
              Proceed →
            </Button>
          </div>

          {linkedUsers.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => { setPhase("sharing"); setRecipientId(null) }}
              >
                Share
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => { setPhase("gifting"); setRecipientId(null) }}
              >
                Convert to Gift
              </Button>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3 flex gap-3">
            <button
              onClick={() => router.push(`/reflection/${sessionId}`)}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {roundCount < MAX_ROUNDS ? "Continue reflection" : "Review chat"}
            </button>
            <span className="text-gray-200">|</span>
            <button
              onClick={() => router.push("/reflection")}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Start fresh
            </button>
          </div>
        </div>
      )}

      {/* No summary selected yet */}
      {!selectedId && (
        <p className="text-sm text-gray-400 text-center py-2">
          Select a summary above to continue.
        </p>
      )}

      {/* ── Share / Gift panel ────────────────────────────────── */}
      {(phase === "sharing" || phase === "gifting") && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {phase === "gifting" ? "Convert to Gift" : "Share with"}
            </h3>
            <button
              onClick={() => setPhase("idle")}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕ Cancel
            </button>
          </div>

          {/* Recipient selector */}
          <div className="space-y-2">
            {linkedUsers.map(u => (
              <button
                key={u.id}
                onClick={() => setRecipientId(u.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all",
                  recipientId === u.id
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-100 hover:border-brand-200",
                )}
              >
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
                  {(u.name ?? u.email)[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name ?? "—"}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Optional message (gift only) */}
          {phase === "gifting" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Personal message (optional)
              </label>
              <textarea
                value={giftMessage}
                onChange={e => setGiftMessage(e.target.value)}
                placeholder="Add a note with your gift…"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <Button
            size="lg"
            onClick={handleShareOrGift}
            disabled={!recipientId}
            loading={saving}
          >
            {phase === "gifting" ? "Send gift" : "Share"}
          </Button>
        </div>
      )}
    </div>
  )
}
