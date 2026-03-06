import Anthropic from "@anthropic-ai/sdk"

const MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 600
const SUMMARY_MAX_TOKENS = 600

export interface LLMMessage {
  role: "user" | "assistant"
  content: string
}

export interface MIResponse {
  content: string
  emotionLabel: string | null
  insight: string | null
}

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}

const isStub =
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY === "sk-ant-placeholder"

// ── Response validator ────────────────────────────────────────────────────

const FORBIDDEN_CLINICAL = [
  "anxiety", "depression", "trauma", "disorder", "symptoms",
  "mental health", "therapy", "therapist", "diagnosis", "diagnose",
  "adhd", "ocd", "ptsd", "psychiatric", "counselling", "counseling",
  "counselor", "bipolar", "autism", "medication", "treatment",
  "clinical", "pathology",
]

const FORBIDDEN_ADVICE = [
  "you should", "you need to", "i suggest", "i recommend",
  "i advise", "have you tried", "try to", "what if you tried",
  "it would help if", "a good idea would",
]

/**
 * Returns a list of violations in the text. Empty array = clean.
 * Only applied to the assistant's content, not user messages.
 */
export function validateMIContent(text: string): string[] {
  const lower = text.toLowerCase()
  const violations: string[] = []
  for (const term of [...FORBIDDEN_CLINICAL, ...FORBIDDEN_ADVICE]) {
    if (lower.includes(term)) violations.push(term)
  }
  if (!text.includes("?")) violations.push("missing question mark")
  return violations
}

const SAFE_FALLBACK: MIResponse = {
  content:
    "It sounds like there's a lot beneath the surface of what you're sharing. I'm sitting with that. What feels most true for you right now?",
  emotionLabel: null,
  insight: null,
}

// ── MI call ───────────────────────────────────────────────────────────────

export async function callMI(
  messages: LLMMessage[],
  systemPrompt: string,
): Promise<MIResponse> {
  // Dev stub — allows full UI testing without an API key
  if (isStub) {
    await new Promise(r => setTimeout(r, 800))
    const last = messages[messages.length - 1]?.content ?? ""
    return {
      content: `It sounds like you're exploring something meaningful here. I'm hearing a sense of uncertainty in what you've shared. What feels most important to you about "${last.slice(0, 40)}…"?`,
      emotionLabel: "uncertain",
      insight:
        messages.length > 4
          ? "I'm noticing that you keep returning to questions of expectation — both your own and others'. That might be worth sitting with."
          : null,
    }
  }

  return _callMIWithRetry(messages, systemPrompt, false)
}

async function _callMIWithRetry(
  messages: LLMMessage[],
  systemPrompt: string,
  isRetry: boolean,
): Promise<MIResponse> {
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  })

  const raw =
    response.content[0].type === "text" ? response.content[0].text : ""
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()

  let parsed: MIResponse
  try {
    const obj = JSON.parse(cleaned) as { content?: string; emotionLabel?: string | null; insight?: string | null }
    parsed = {
      content: obj.content ?? raw,
      emotionLabel: obj.emotionLabel ?? null,
      insight: obj.insight ?? null,
    }
  } catch {
    parsed = { content: raw, emotionLabel: null, insight: null }
  }

  // ── Validate ──────────────────────────────────────────────────────
  const violations = validateMIContent(parsed.content)

  if (violations.length === 0) return parsed

  // First violation → retry once with a correction appended to system prompt
  if (!isRetry) {
    const correctionPrompt =
      systemPrompt +
      `\n\n⚠ CORRECTION REQUIRED: Your previous response contained restricted term(s): "${violations.join('", "')}". ` +
      `Rewrite your response without using any of these terms. ` +
      `Keep the same empathic structure but use only approved language.`

    return _callMIWithRetry(messages, correctionPrompt, true)
  }

  // Second violation → safe fallback (log for monitoring)
  console.warn("[MI validator] Fallback used after retry. Violations:", violations)
  return SAFE_FALLBACK
}

// ── Summary generation ────────────────────────────────────────────────────

const SUMMARY_FALLBACKS = [
  "I explored something that has been weighing on me and found it a little easier to hold once I put it into words.",
  "I noticed some patterns in how I see this situation that I hadn't quite named before — and that feels like a start.",
  "I spent time sitting with something uncertain, and while I don't have answers yet, I feel more connected to what I'm actually feeling.",
]

export async function callSummary(
  conversationText: string,
): Promise<{ summaries: string[] }> {
  if (isStub) {
    await new Promise(r => setTimeout(r, 1200))
    return { summaries: SUMMARY_FALLBACKS }
  }

  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: SUMMARY_MAX_TOKENS,
    system: `You write 3 distinct, neutral, first-person summaries of a reflection conversation.

Each summary must:
• Be 2–3 sentences, written in first person ("I explored…", "I noticed…", "I found myself…")
• Be neutral — no advice, no judgment, no clinical language
• Capture a different angle or emphasis from the other two
• Sound like the person is speaking about their own experience — warm and grounded

Return ONLY valid JSON: { "summaries": ["...", "...", "..."] }`,
    messages: [
      {
        role: "user",
        content: `Generate 3 summary options for this reflection:\n\n${conversationText}`,
      },
    ],
  })

  const raw = response.content[0].type === "text" ? response.content[0].text : ""
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()

  try {
    const parsed = JSON.parse(cleaned) as { summaries?: string[] }
    if (Array.isArray(parsed.summaries) && parsed.summaries.length > 0) {
      return { summaries: parsed.summaries.slice(0, 3) }
    }
  } catch { /* fall through */ }

  return { summaries: SUMMARY_FALLBACKS }
}
