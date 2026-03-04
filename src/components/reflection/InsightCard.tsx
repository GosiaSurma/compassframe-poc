"use client"

const RESPONSES = [
  { key: "resonates" as const, label: "That resonates" },
  { key: "not_quite" as const, label: "Not quite" },
  { key: "clarify"   as const, label: "I want to clarify" },
]

const RESPONSE_LABELS: Record<string, string> = {
  resonates:  "✓ That resonated with you",
  not_quite:  "✓ You noted this doesn't quite fit",
  clarify:    "✓ You wanted to clarify",
}

interface Props {
  text: string
  messageId: string
  responded: boolean
  currentResponse: string | null
  onRespond: (messageId: string, response: "resonates" | "not_quite" | "clarify") => void
}

export function InsightCard({ text, messageId, responded, currentResponse, onRespond }: Props) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 max-w-[88%]">
      <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-1.5">
        Highlighted Insight
      </p>
      <p className="text-sm text-amber-900 leading-relaxed mb-3">{text}</p>

      {!responded ? (
        <div className="flex flex-wrap gap-2">
          {RESPONSES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onRespond(messageId, key)}
              className="text-xs px-3 py-1.5 rounded-full border border-amber-300 text-amber-800 hover:bg-amber-100 active:bg-amber-200 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-amber-600 italic">
          {currentResponse ? RESPONSE_LABELS[currentResponse] : "✓ Responded"}
        </p>
      )}
    </div>
  )
}
