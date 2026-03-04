"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ChallengeItem {
  id: string
  text: string
  topic: string | null
  completedAt: string | null
  createdAt: string
}

interface LatestContext {
  sessionId: string
  topic: string
  summaryText: string | null
}

interface Props {
  latestContext: LatestContext | null
  challenges: ChallengeItem[]
}

export function ChallengeClient({ latestContext, challenges: initial }: Props) {
  const [challenges, setChallenges] = useState(initial)
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function handleAdd() {
    if (!text.trim()) return
    setSaving(true)
    setError(null)

    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sessionId: latestContext?.sessionId ?? undefined,
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to save")
      setSaving(false)
      return
    }

    const created = await res.json()
    setChallenges(prev => [
      {
        id: created.id,
        text: created.text,
        topic: created.session?.topic ?? null,
        completedAt: null,
        createdAt: created.createdAt,
      },
      ...prev,
    ])
    setText("")
    setSaving(false)
  }

  async function handleToggle(id: string) {
    setTogglingId(id)
    const res = await fetch(`/api/challenges/${id}`, { method: "PATCH" })
    if (res.ok) {
      const updated = await res.json()
      setChallenges(prev =>
        prev.map(c =>
          c.id === id ? { ...c, completedAt: updated.completedAt ?? null } : c,
        ),
      )
    }
    setTogglingId(null)
  }

  const open = challenges.filter(c => !c.completedAt)
  const done = challenges.filter(c => c.completedAt)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Challenge</h1>
      <p className="text-sm text-gray-500 mb-6">
        Turn your reflection into a small, concrete action.
      </p>

      {/* Context card */}
      {latestContext?.summaryText && (
        <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 mb-6">
          <p className="text-xs font-medium text-brand-600 mb-1">
            From your reflection · {latestContext.topic}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{latestContext.summaryText}</p>
        </div>
      )}

      {/* New challenge form */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What&apos;s one thing you&apos;ll try or do differently?
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. I'll talk to my mum about this before Friday."
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3"
        />
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg mb-3">
            {error}
          </p>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={handleAdd}
          disabled={!text.trim()}
          loading={saving}
        >
          Set challenge
        </Button>
      </div>

      {/* Open challenges */}
      {open.length > 0 && (
        <section className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">
            In progress ({open.length})
          </p>
          <ul className="space-y-2">
            {open.map(c => (
              <ChallengeRow
                key={c.id}
                challenge={c}
                toggling={togglingId === c.id}
                onToggle={handleToggle}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Completed challenges */}
      {done.length > 0 && (
        <section>
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">
            Completed ({done.length})
          </p>
          <ul className="space-y-2">
            {done.map(c => (
              <ChallengeRow
                key={c.id}
                challenge={c}
                toggling={togglingId === c.id}
                onToggle={handleToggle}
              />
            ))}
          </ul>
        </section>
      )}

      {challenges.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          No challenges yet. Set your first one above.
        </p>
      )}
    </div>
  )
}

function ChallengeRow({
  challenge,
  toggling,
  onToggle,
}: {
  challenge: ChallengeItem
  toggling: boolean
  onToggle: (id: string) => void
}) {
  const done = !!challenge.completedAt

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border-2 p-4 transition-all",
        done ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-white",
      )}
    >
      <button
        onClick={() => onToggle(challenge.id)}
        disabled={toggling}
        className={cn(
          "w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors",
          done
            ? "border-green-500 bg-green-500"
            : "border-gray-300 hover:border-brand-400",
        )}
      >
        {done && <span className="text-white text-[10px] leading-none">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-relaxed", done ? "line-through text-gray-400" : "text-gray-800")}>
          {challenge.text}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {challenge.topic && <span>{challenge.topic} · </span>}
          {new Date(challenge.createdAt).toLocaleDateString()}
          {done && challenge.completedAt && (
            <span className="text-green-500 ml-1">
              · Done {new Date(challenge.completedAt).toLocaleDateString()}
            </span>
          )}
        </p>
      </div>
    </li>
  )
}
