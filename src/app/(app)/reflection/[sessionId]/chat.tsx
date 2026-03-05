"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChatBubble, type MessageData } from "@/components/reflection/ChatBubble"
import { Button } from "@/components/ui/button"

const MAX_ROUNDS = 12

interface SessionInfo {
  id: string
  topic: string
  status: string
  roundCount: number
}

interface Props {
  session: SessionInfo
  initialMessages: MessageData[]
  magicalMode: string
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold mt-0.5">
        ✦
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 bg-gray-300 rounded-full inline-block animate-bounce"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function Chat({ session, initialMessages, magicalMode }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<MessageData[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roundCount, setRoundCount] = useState(session.roundCount)

  // Track which assistant messages have received an insight response
  const [respondedInsights, setRespondedInsights] = useState<Set<string>>(
    () => {
      const s = new Set<string>()
      initialMessages.filter(m => m.insightResponse !== null).forEach(m => s.add(m.id))
      return s
    },
  )

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const isComplete = roundCount >= MAX_ROUNDS

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading || isComplete) return

    // Optimistic user message
    const tempId = `temp-${Date.now()}`
    const optimisticMsg: MessageData = {
      id: tempId,
      role: "user",
      content: text,
      insightText: null,
      insightResponse: null,
    }

    setMessages(prev => [...prev, optimisticMsg])
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/reflection/sessions/${session.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      })

      if (!res.ok) {
        const data = await res.json()
        // Roll back optimistic message
        setMessages(prev => prev.filter(m => m.id !== tempId))
        setError(data.error ?? "Failed to send message")
        return
      }

      const data = await res.json()
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ])
      setRoundCount(data.roundCount)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInsightResponse = useCallback(
    async (messageId: string, response: "resonates" | "not_quite" | "clarify") => {
      // Optimistically mark as responded
      setRespondedInsights(prev => { const s = new Set(prev); s.add(messageId); return s })

      if (response === "clarify") {
        // "Clarify" focuses input; the user's next message serves as clarification
        setTimeout(() => textareaRef.current?.focus(), 50)
        // Still record the response
      }

      // Persist to DB (fire-and-forget for UX, but we still await to catch errors)
      try {
        await fetch(`/api/reflection/sessions/${session.id}/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insightResponse: response }),
        })
        // Update local state with the saved response
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, insightResponse: response } : m)),
        )
      } catch {
        // Non-critical — insight response failure doesn't break the session
      }
    },
    [session.id],
  )

  const wrapperClass =
    magicalMode === "light"
      ? "flex flex-col min-h-full bg-amber-50/30"
      : "flex flex-col min-h-full"

  return (
    <div className={wrapperClass}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <button
          onClick={() => router.push("/reflection")}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back
        </button>
        <span className="text-sm font-medium text-gray-700 truncate max-w-[40%]">
          {session.topic}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {roundCount >= 1 && !isComplete && (
            <button
              onClick={() => router.push(`/reflection/${session.id}/summary`)}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
            >
              Wrap up →
            </button>
          )}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isComplete
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {roundCount}/{MAX_ROUNDS}
          </span>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-5 space-y-5">
        {messages.map(msg => (
          <ChatBubble
            key={msg.id}
            message={msg}
            responded={respondedInsights.has(msg.id)}
            onInsightResponse={handleInsightResponse}
            onClarify={() => setTimeout(() => textareaRef.current?.focus(), 50)}
          />
        ))}

        {isLoading && <TypingIndicator />}

        {isComplete && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-sm font-semibold text-green-800 mb-1">
              Reflection complete ✓
            </p>
            <p className="text-xs text-green-700 mb-4">
              You&apos;ve completed 12 rounds. Ready to review and summarise your reflection?
            </p>
            <Button
              size="sm"
              onClick={() => router.push(`/reflection/${session.id}/summary`)}
            >
              Review summary →
            </Button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────────── */}
      {!isComplete && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3">
          {error && (
            <p className="text-xs text-red-600 mb-2 px-1">{error}</p>
          )}
          <form onSubmit={handleSend} className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend(e as unknown as React.FormEvent)
                }
              }}
              placeholder="Share what's on your mind… (Shift+Enter for new line)"
              rows={1}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 overflow-auto"
              style={{ minHeight: "40px", maxHeight: "120px" }}
            />
            <Button
              type="submit"
              size="md"
              disabled={!input.trim() || isLoading}
              loading={isLoading}
              className="shrink-0"
            >
              Send
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
