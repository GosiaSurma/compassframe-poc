import Anthropic from "@anthropic-ai/sdk"

const MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 700
const SUMMARY_MAX_TOKENS = 600

export interface LLMMessage {
  role: "user" | "assistant"
  content: string
}

export interface HighlightedInsight {
  enabled: boolean
  text: string
  symbolic_marker: "fire" | "water" | "air" | "earth" | null
}

export interface MIResponse {
  reflection_text: string
  emotion_label: string
  follow_up_question: string
  highlighted_insight: HighlightedInsight | null
  progress_stage: "situation" | "feeling" | "meaning" | "consolidation"
  topic_anchor: string
  summary_readiness_score: number
}

interface MICallContext {
  topic: string
  stage: MIResponse["progress_stage"]
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

// ── Validation ────────────────────────────────────────────────────────────

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

const FORBIDDEN_GENERIC = [
  "you're exploring something meaningful",
  "you are exploring something meaningful",
  "it sounds like you're on a journey",
  "this is a journey",
  "i'm here to help",
  "i am here to help",
  "i'm here to support",
  "that's really important",
  "that is really important",
]

/** Returns a list of violations. Empty array = clean. */
export function validateMIResponse(r: MIResponse): string[] {
  const combined = (r.reflection_text + " " + r.follow_up_question).toLowerCase()
  const violations: string[] = []
  for (const term of [...FORBIDDEN_CLINICAL, ...FORBIDDEN_ADVICE, ...FORBIDDEN_GENERIC]) {
    if (combined.includes(term)) violations.push(term)
  }
  if (!r.follow_up_question.includes("?")) {
    violations.push("missing question mark in follow_up_question")
  }
  return violations
}

// ── Parsing ────────────────────────────────────────────────────────────────

const VALID_STAGES = new Set(["situation", "feeling", "meaning", "consolidation"])
const VALID_MARKERS = new Set(["fire", "water", "air", "earth"])

function parseMIResponse(raw: string): MIResponse | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>

    if (
      typeof obj.reflection_text !== "string" || !obj.reflection_text.trim() ||
      typeof obj.follow_up_question !== "string" || !obj.follow_up_question.trim() ||
      typeof obj.progress_stage !== "string" ||
      typeof obj.topic_anchor !== "string" ||
      typeof obj.summary_readiness_score !== "number"
    ) return null

    if (!VALID_STAGES.has(obj.progress_stage as string)) return null

    const score = obj.summary_readiness_score as number
    if (score < 0 || score > 100) return null

    const emotionLabel =
      typeof obj.emotion_label === "string" ? obj.emotion_label.trim() : ""

    let insight: HighlightedInsight | null = null
    const hi = obj.highlighted_insight
    if (hi && typeof hi === "object") {
      const hiObj = hi as Record<string, unknown>
      if (hiObj.enabled === true && typeof hiObj.text === "string" && hiObj.text.trim()) {
        const rawMarker = hiObj.symbolic_marker
        const marker =
          typeof rawMarker === "string" && VALID_MARKERS.has(rawMarker)
            ? (rawMarker as "fire" | "water" | "air" | "earth")
            : null
        insight = { enabled: true, text: hiObj.text.trim(), symbolic_marker: marker }
      }
    }

    return {
      reflection_text: (obj.reflection_text as string).trim(),
      emotion_label: emotionLabel,
      follow_up_question: (obj.follow_up_question as string).trim(),
      highlighted_insight: insight,
      progress_stage: obj.progress_stage as MIResponse["progress_stage"],
      topic_anchor: (obj.topic_anchor as string).trim(),
      summary_readiness_score: Math.round(score),
    }
  } catch {
    return null
  }
}

// ── Fallback ───────────────────────────────────────────────────────────────

function makeSafeFallback(context?: MICallContext): MIResponse {
  const topic = context?.topic ?? "this"
  const stage = context?.stage ?? "situation"
  return {
    reflection_text:
      "I want to make sure I'm really hearing what you're saying about " + topic + ".",
    emotion_label: "unsettled",
    follow_up_question: `What feels most significant to you about ${topic} right now?`,
    highlighted_insight: null,
    progress_stage: stage,
    topic_anchor: topic,
    summary_readiness_score: 10,
  }
}

// ── MI call ───────────────────────────────────────────────────────────────

export async function callMI(
  messages: LLMMessage[],
  systemPrompt: string,
  context?: MICallContext,
): Promise<MIResponse> {
  // Dev stub — full UI testing without an API key
  if (isStub) {
    await new Promise(r => setTimeout(r, 800))
    const last = messages[messages.length - 1]?.content ?? ""
    const topic = context?.topic ?? "this topic"
    const stage = context?.stage ?? "situation"
    return {
      reflection_text: `It sounds like "${last.slice(0, 50).trim()}" carries real weight for you. I'm noticing a sense of uncertainty as you hold this.`,
      emotion_label: "uncertain",
      follow_up_question: `What aspect of ${topic} feels most present for you right now?`,
      highlighted_insight:
        messages.length > 4
          ? {
              enabled: true,
              text: "I'm noticing that questions of expectation keep surfacing — both your own and others'. That pattern might be worth sitting with.",
              symbolic_marker: "water",
            }
          : null,
      progress_stage: stage,
      topic_anchor: topic,
      summary_readiness_score: Math.min(10 + messages.length * 5, 80),
    }
  }

  return _callMIWithRetry(messages, systemPrompt, false, context)
}

async function _callMIWithRetry(
  messages: LLMMessage[],
  systemPrompt: string,
  isRetry: boolean,
  context?: MICallContext,
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

  const parsed = parseMIResponse(raw)

  if (!parsed) {
    if (!isRetry) {
      const correctionPrompt =
        systemPrompt +
        "\n\n⚠ CORRECTION REQUIRED: Your previous response was not valid JSON matching the required schema. " +
        "Return ONLY a valid JSON object with all required fields: reflection_text, emotion_label, follow_up_question, highlighted_insight, progress_stage, topic_anchor, summary_readiness_score. No markdown fences."
      return _callMIWithRetry(messages, correctionPrompt, true, context)
    }
    console.warn("[MI parser] Fallback used — could not parse structured response.")
    return makeSafeFallback(context)
  }

  const violations = validateMIResponse(parsed)
  if (violations.length === 0) return parsed

  if (!isRetry) {
    const correctionPrompt =
      systemPrompt +
      `\n\n⚠ CORRECTION REQUIRED: Your previous response contained restricted term(s): "${violations.join('", "')}". ` +
      `Rewrite without using any of these terms. Keep the same empathic structure but use only approved language.`
    return _callMIWithRetry(messages, correctionPrompt, true, context)
  }

  console.warn("[MI validator] Fallback after retry. Violations:", violations)
  return makeSafeFallback(context)
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
