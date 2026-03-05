"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"

const TOPICS = [
  { label: "School & learning",       emoji: "📚" },
  { label: "Friends & relationships", emoji: "👥" },
  { label: "Family dynamics",         emoji: "🏠" },
  { label: "Hopes & dreams",          emoji: "✨" },
  { label: "Stress & pressure",       emoji: "🌊" },
  { label: "A recent situation",      emoji: "📖" },
  { label: "Something I'm proud of",  emoji: "⭐" },
  { label: "Something on my mind",    emoji: "💭" },
]

const MAX_CUSTOM_TOPIC = 120

interface RecentSession {
  id: string
  topic: string
  status: string
  roundCount: number
  updatedAt: Date
}

export function TopicSelector({ recentSessions }: { recentSessions: RecentSession[] }) {
  const router = useRouter()
  const [loadingTopic, setLoadingTopic] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // "Other" topic state
  const [otherExpanded, setOtherExpanded] = useState(false)
  const [customTopic, setCustomTopic] = useState("")
  const customInputRef = useRef<HTMLInputElement>(null)

  const activeSessions = recentSessions.filter(
    s => s.status !== "completed" && s.roundCount > 0,
  )
  const completedSessions = recentSessions.filter(s => s.status === "completed")

  async function startReflection(topic: string) {
    const trimmed = topic.trim()
    if (!trimmed) return
    setLoadingTopic(trimmed)
    setError(null)

    try {
      const res = await fetch("/api/reflection/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to start session")
        return
      }

      const { sessionId } = await res.json()
      router.push(`/reflection/${sessionId}`)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoadingTopic(null)
    }
  }

  function handleOtherExpand() {
    setOtherExpanded(true)
    setTimeout(() => customInputRef.current?.focus(), 50)
  }

  function handleCustomStart() {
    if (!customTopic.trim()) return
    startReflection(customTopic)
  }

  return (
    <div className="space-y-8">
      {/* ── In-progress sessions ──────────────────────────────── */}
      {activeSessions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Continue
          </h2>
          <div className="space-y-2">
            {activeSessions.map(s => (
              <Link
                key={s.id}
                href={`/reflection/${s.id}`}
                className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-brand-200 transition-colors group"
              >
                <span className="text-sm text-gray-800 group-hover:text-brand-700 transition-colors">
                  {s.topic}
                </span>
                <span className="text-xs text-gray-400">
                  {s.roundCount}/12 rounds →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Topic grid ────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Start new reflection
        </h2>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg mb-4">
            {error}
          </p>
        )}

        {loadingTopic && (
          <p className="text-sm text-brand-600 mb-3 animate-pulse">
            Starting reflection on &quot;{loadingTopic}&quot;…
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {TOPICS.map(({ label, emoji }) => (
            <button
              key={label}
              onClick={() => startReflection(label)}
              disabled={loadingTopic !== null}
              className={cn(
                "bg-white border border-gray-100 rounded-xl p-4 text-left",
                "flex items-start gap-3 transition-all",
                "hover:border-brand-200 hover:shadow-sm",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                loadingTopic === label && "border-brand-300 bg-brand-50",
              )}
            >
              <span className="text-xl mt-0.5 shrink-0">{emoji}</span>
              <span className="text-sm text-gray-700 leading-snug">{label}</span>
            </button>
          ))}

          {/* ── Other topic ──────────────────────────────────── */}
          {!otherExpanded ? (
            <button
              onClick={handleOtherExpand}
              disabled={loadingTopic !== null}
              className={cn(
                "bg-white border border-gray-100 rounded-xl p-4 text-left",
                "flex items-start gap-3 transition-all",
                "hover:border-brand-200 hover:shadow-sm",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              )}
            >
              <span className="text-xl mt-0.5 shrink-0">✏️</span>
              <span className="text-sm text-gray-400 leading-snug">Something else…</span>
            </button>
          ) : (
            <div className="col-span-2 bg-brand-50 border-2 border-brand-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-brand-700">What would you like to explore?</p>
              <input
                ref={customInputRef}
                type="text"
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value.slice(0, MAX_CUSTOM_TOPIC))}
                onKeyDown={e => e.key === "Enter" && handleCustomStart()}
                placeholder="Describe your topic…"
                className="w-full text-sm border border-brand-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCustomStart}
                  disabled={!customTopic.trim() || loadingTopic !== null}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-lg transition-colors",
                    customTopic.trim()
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed",
                  )}
                >
                  Start reflection
                </button>
                <button
                  onClick={() => { setOtherExpanded(false); setCustomTopic("") }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <span className="ml-auto text-xs text-gray-300">
                  {customTopic.length}/{MAX_CUSTOM_TOPIC}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Completed sessions ────────────────────────────────── */}
      {completedSessions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Past reflections
          </h2>
          <div className="space-y-2">
            {completedSessions.map(s => (
              <Link
                key={s.id}
                href={`/reflection/${s.id}/summary`}
                className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-gray-200 transition-colors"
              >
                <span className="text-sm text-gray-600">{s.topic}</span>
                <span className="text-xs text-green-600">Completed ✓</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
