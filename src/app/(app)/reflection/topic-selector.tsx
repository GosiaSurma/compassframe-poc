"use client"

import { useState } from "react"
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

  const activeSessions = recentSessions.filter(
    s => s.status !== "completed" && s.roundCount > 0,
  )
  const completedSessions = recentSessions.filter(s => s.status === "completed")

  async function startReflection(topic: string) {
    setLoadingTopic(topic)
    setError(null)

    try {
      const res = await fetch("/api/reflection/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
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
