"use client"

type InsightResponse = "resonates" | "not_quite" | "clarify"

const RESPONSES: { key: InsightResponse; label: string }[] = [
  { key: "resonates", label: "That resonates" },
  { key: "not_quite", label: "Not quite" },
  { key: "clarify",   label: "I want to clarify" },
]

const RESPONSE_LABELS: Record<string, string> = {
  resonates: "✓ That resonated with you",
  not_quite: "✓ You noted this doesn't quite fit",
  clarify:   "✓ You wanted to clarify",
}

// ── Elemental themes (Full mode) ──────────────────────────────────────────

const ELEMENTS = [
  {
    key:     "fire",
    name:    "Fire", emoji: "🔥",
    card:    "bg-rose-50 border-rose-200",
    heading: "text-rose-600",
    body:    "text-rose-900",
    btn:     "border-rose-300 text-rose-800 hover:bg-rose-100 active:bg-rose-200",
    done:    "text-rose-500",
  },
  {
    key:     "water",
    name:    "Water", emoji: "💧",
    card:    "bg-blue-50 border-blue-200",
    heading: "text-blue-600",
    body:    "text-blue-900",
    btn:     "border-blue-300 text-blue-800 hover:bg-blue-100 active:bg-blue-200",
    done:    "text-blue-500",
  },
  {
    key:     "air",
    name:    "Air", emoji: "🌬️",
    card:    "bg-violet-50 border-violet-200",
    heading: "text-violet-600",
    body:    "text-violet-900",
    btn:     "border-violet-300 text-violet-800 hover:bg-violet-100 active:bg-violet-200",
    done:    "text-violet-500",
  },
  {
    key:     "earth",
    name:    "Earth", emoji: "🌿",
    card:    "bg-emerald-50 border-emerald-200",
    heading: "text-emerald-600",
    body:    "text-emerald-900",
    btn:     "border-emerald-300 text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200",
    done:    "text-emerald-500",
  },
] as const

type ElementKey = "fire" | "water" | "air" | "earth"

/** Find element by AI-supplied marker key. */
function elementByMarker(marker: string): typeof ELEMENTS[number] | null {
  return ELEMENTS.find(e => e.key === marker) ?? null
}

/** Deterministic element from message ID — fallback when no marker supplied. */
function pickElement(messageId: string): typeof ELEMENTS[number] {
  let hash = 0
  for (let i = 0; i < messageId.length; i++) hash += messageId.charCodeAt(i)
  return ELEMENTS[hash % ELEMENTS.length]
}

// ── Off / Light base theme ────────────────────────────────────────────────

const BASE = {
  card:    "bg-amber-50 border-amber-200",
  heading: "text-amber-600",
  body:    "text-amber-900",
  btn:     "border-amber-300 text-amber-800 hover:bg-amber-100 active:bg-amber-200",
  done:    "text-amber-600",
}

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  text: string
  messageId: string
  responded: boolean
  currentResponse: string | null
  magicalMode: string
  symbolicMarker: string | null
  onRespond: (messageId: string, response: InsightResponse) => void
}

export function InsightCard({
  text,
  messageId,
  responded,
  currentResponse,
  magicalMode,
  symbolicMarker,
  onRespond,
}: Props) {
  const isFull = magicalMode === "full"
  const isLight = magicalMode === "light"

  // Resolve element: AI marker takes priority; hash fallback for full mode
  const resolvedMarker = (isFull || isLight) ? (symbolicMarker as ElementKey | null) : null
  const element = isFull
    ? (resolvedMarker ? elementByMarker(resolvedMarker) : null) ?? pickElement(messageId)
    : null

  const el = element ?? BASE

  // Heading: Full = element name + emoji; Light with marker = emoji only; Light plain = ✦
  const headingText = element
    ? `${element.emoji} ${element.name} Insight`
    : (isLight && resolvedMarker)
      ? `${elementByMarker(resolvedMarker)?.emoji ?? "✦"} Insight`
      : isLight
        ? "✦ Insight"
        : "Highlighted Insight"

  return (
    <div className={`border rounded-2xl px-4 py-3 max-w-[88%] ${el.card}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${el.heading}`}>
        {headingText}
      </p>
      <p className={`text-sm leading-relaxed mb-3 ${el.body}`}>{text}</p>

      {!responded ? (
        <div className="flex flex-wrap gap-2">
          {RESPONSES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onRespond(messageId, key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${el.btn}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className={`text-xs italic ${el.done}`}>
          {currentResponse ? RESPONSE_LABELS[currentResponse] : "✓ Responded"}
        </p>
      )}
    </div>
  )
}
