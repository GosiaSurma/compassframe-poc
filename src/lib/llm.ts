import Anthropic from "@anthropic-ai/sdk"

const MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 700
const SUMMARY_MAX_TOKENS = 600
const CHALLENGE_MAX_TOKENS = 300

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
  progress_stage: "situation" | "feeling" | "meaning" | "integration"
  topic_anchor: string
  summary_readiness_score: number
}

interface MICallContext {
  topic: string
  stage: MIResponse["progress_stage"]
  usedEmotions?: string[]
  priorQuestion?: string | null
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

const PLACEHOLDER_RE = /<[^>]{2,60}>/

function questionWordOverlap(a: string, b: string): number {
  const split = (s: string) => s.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const wordsA = split(a)
  const wb = new Set(split(b))
  const intersection = wordsA.filter(w => wb.has(w)).length
  const union = new Set(wordsA).size + wb.size - intersection
  return union > 0 ? intersection / union : 0
}

/** Returns a list of violations. Empty array = clean. */
export function validateMIResponse(r: MIResponse, ctx?: MICallContext): string[] {
  const combined = (r.reflection_text + " " + r.follow_up_question).toLowerCase()
  const violations: string[] = []

  for (const term of [...FORBIDDEN_CLINICAL, ...FORBIDDEN_ADVICE, ...FORBIDDEN_GENERIC]) {
    if (combined.includes(term)) violations.push(term)
  }

  if (!r.follow_up_question.includes("?")) {
    violations.push("missing question mark in follow_up_question")
  }

  // Placeholder text: angle-bracket template tokens left unfilled
  if (PLACEHOLDER_RE.test(r.reflection_text) || PLACEHOLDER_RE.test(r.follow_up_question)) {
    violations.push("unfilled template placeholder in response")
  }

  // Repeated emotion label
  if (ctx?.usedEmotions && r.emotion_label) {
    if (ctx.usedEmotions.map(e => e.toLowerCase()).includes(r.emotion_label.toLowerCase())) {
      violations.push(`repeated emotion label: "${r.emotion_label}"`)
    }
  }

  // Repeated question pattern (>55% word overlap with prior question)
  if (ctx?.priorQuestion && r.follow_up_question) {
    const overlap = questionWordOverlap(r.follow_up_question, ctx.priorQuestion)
    if (overlap > 0.55) {
      violations.push("follow_up_question too similar to prior question")
    }
  }

  return violations
}

// ── Parsing ────────────────────────────────────────────────────────────────

const VALID_STAGES = new Set(["situation", "feeling", "meaning", "integration"])
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

  const violations = validateMIResponse(parsed, context)
  if (violations.length === 0) return parsed

  if (!isRetry) {
    const correctionPrompt =
      systemPrompt +
      `\n\n⚠ CORRECTION REQUIRED: Your previous response violated one or more rules: "${violations.join('", "')}". ` +
      `Rewrite to fix all violations. Keep the same empathic structure but use only approved language.`
    return _callMIWithRetry(messages, correctionPrompt, true, context)
  }

  console.warn("[MI validator] Fallback after retry. Violations:", violations)
  return makeSafeFallback(context)
}

// ── Summary generation ────────────────────────────────────────────────────

export interface SummaryContext {
  topic: string
  roundCount: number
  conversationLines: string[]
  emotionalThemes: string[]
  acceptedInsights: string[]
  clarifiedInsights: string[]
  finalUserTurns: string[]
}

export function buildSummaryPrompt(ctx: SummaryContext): string {
  const {
    topic, roundCount, conversationLines,
    emotionalThemes, acceptedInsights, clarifiedInsights, finalUserTurns,
  } = ctx

  const emotionBlock = emotionalThemes.length > 0
    ? emotionalThemes.map(e => `• ${e}`).join("\n")
    : "• none detected"

  const insightBlock = [
    ...acceptedInsights.map(i => `• (resonated) "${i.slice(0, 120)}"`),
    ...clarifiedInsights.map(i => `• (clarified) "${i.slice(0, 120)}"`),
  ].join("\n") || "• none"

  const finalTurnsBlock = finalUserTurns.length > 0
    ? finalUserTurns.map((t, i) => `${i + 1}. "${t.slice(0, 180)}"`).join("\n")
    : "• (no user messages)"

  return `You write exactly 3 first-person summaries of a reflection conversation, written as the person who reflected — in their voice, about their experience.

━━ CONVERSATION CONTEXT ━━
Topic: "${topic}"
Rounds completed: ${roundCount}

Emotional themes named across this session:
${emotionBlock}

Insights the person actively engaged with:
${insightBlock}

The person's final messages (most recent first):
${finalTurnsBlock}

━━ FULL CONVERSATION TRANSCRIPT ━━
${conversationLines.join("\n\n")}

━━ RULES ━━
• Write in first person — start every summary with "I"
• Each summary: 2–3 sentences, 25–60 words
• Every summary must reference SPECIFIC content from this exact conversation — the topic, emotions named, things actually said, or insights engaged with
• Forbidden openers: "I explored something", "I spent time", "I found myself sitting"
• Forbidden words/phrases: "journey", "meaningful experience", "important growth", "i need to", "i should", "i must"
• No advice, no judgment, no clinical language, no diagnosis

━━ THREE REQUIRED EMPHASES — each must be clearly distinct ━━
Summary 1 — EMOTIONAL CLARITY
What specific emotion was named or felt? What shifted emotionally for the person?
Write about the emotional texture of THIS specific conversation.

Summary 2 — PATTERN OR MEANING
What pattern, realisation, or personal meaning became clearer?
Something newly named, seen, or understood in this conversation — not generic.

Summary 3 — READINESS OR NEXT AWARENESS
Where does the person feel they are now? What is clearer or more honest?
A sense of shifted awareness or nascent direction — not a plan, not an action item.

━━ OUTPUT — valid JSON only, no markdown fences ━━
{
  "summaries": [
    "<emotional clarity — 2-3 sentences, specific to this conversation>",
    "<pattern or meaning — 2-3 sentences, specific to this conversation>",
    "<readiness or next awareness — 2-3 sentences, specific to this conversation>"
  ]
}`
}

const SUMMARY_FORBIDDEN = [
  "i explored something", "i spent time sitting", "i found myself sitting",
  "i spent time with", "important growth", "meaningful experience",
  "it was helpful", "i feel better now", "you should", "you need to",
  "i need to", "i should", "i must", "journey",
  "anxiety", "depression", "trauma", "disorder", "diagnosis",
]

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const setA = new Set(wordsA)
  const intersection = wordsA.filter(w => wordsB.has(w)).length
  const union = setA.size + wordsB.size - intersection
  return union > 0 ? intersection / union : 0
}

export function validateSummaries(summaries: string[]): string[] {
  if (summaries.length < 3) return ["fewer than 3 summaries returned"]

  const violations: string[] = []

  summaries.forEach((s, i) => {
    const label = `summary ${i + 1}`
    const lower = s.toLowerCase()
    const words = s.trim().split(/\s+/).length

    if (!s.trimStart().match(/^I[ ']/)) violations.push(`${label}: must start with "I"`)
    if (words < 20) violations.push(`${label}: too short (${words} words)`)
    if (words > 80) violations.push(`${label}: too long (${words} words)`)
    for (const phrase of SUMMARY_FORBIDDEN) {
      if (lower.includes(phrase)) violations.push(`${label}: forbidden phrase "${phrase}"`)
    }
  })

  const pairs = [[0, 1], [0, 2], [1, 2]] as const
  for (const [i, j] of pairs) {
    const sim = jaccardSimilarity(summaries[i], summaries[j])
    if (sim > 0.45) {
      violations.push(
        `summaries ${i + 1} and ${j + 1} are too similar (${(sim * 100).toFixed(0)}% content overlap)`,
      )
    }
  }

  return violations
}

function makeSummaryFallbacks(ctx: SummaryContext): string[] {
  const { topic, emotionalThemes, acceptedInsights } = ctx
  const emotion = emotionalThemes[0] ?? "unsettled"
  const rawInsight = acceptedInsights[0]
  const insightSnippet = rawInsight
    ? rawInsight
        .replace(/^I'm noticing[,.\s]*/i, "")
        .replace(/^Something that stands out[,.\s]*/i, "")
        .slice(0, 90)
        .toLowerCase()
    : null

  return [
    `I noticed I was holding something ${emotion} around ${topic}, and naming that made it a little easier to sit with.`,
    insightSnippet
      ? `Something became clearer to me: ${insightSnippet}. I hadn't quite put that into words before this conversation.`
      : `A pattern emerged around ${topic} that I hadn't been able to see from inside it — and seeing it shifted something.`,
    `I don't have it resolved, but I feel more honest with myself about where I actually am with ${topic} right now.`,
  ]
}

export async function callSummary(ctx: SummaryContext): Promise<{ summaries: string[] }> {
  if (isStub) {
    await new Promise(r => setTimeout(r, 1200))
    return { summaries: makeSummaryFallbacks(ctx) }
  }
  return _callSummaryWithRetry(ctx, false)
}

async function _callSummaryWithRetry(
  ctx: SummaryContext,
  isRetry: boolean,
): Promise<{ summaries: string[] }> {
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: SUMMARY_MAX_TOKENS,
    system: buildSummaryPrompt(ctx),
    messages: [{ role: "user", content: "Generate the 3 summaries now." }],
  })

  const raw = response.content[0].type === "text" ? response.content[0].text : ""
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()

  let parsed: string[] | null = null
  try {
    const obj = JSON.parse(cleaned) as { summaries?: unknown }
    if (Array.isArray(obj.summaries) && obj.summaries.length >= 3) {
      const candidates = (obj.summaries as unknown[]).filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      )
      if (candidates.length >= 3) parsed = candidates.slice(0, 3)
    }
  } catch { /* fall through */ }

  if (!parsed) {
    if (!isRetry) return _callSummaryWithRetry(ctx, true)
    console.warn("[summary] Fallback — could not parse response.")
    return { summaries: makeSummaryFallbacks(ctx) }
  }

  const violations = validateSummaries(parsed)
  if (violations.length === 0) return { summaries: parsed }

  if (!isRetry) {
    console.warn("[summary] Validation violations, retrying:", violations)
    return _callSummaryWithRetry(ctx, true)
  }

  console.warn("[summary] Fallback after retry. Violations:", violations)
  return { summaries: makeSummaryFallbacks(ctx) }
}

// ── Challenge suggestion generation ──────────────────────────────────────

export interface ChallengeContext {
  topic: string
  summaryText: string
  emotionalTheme: string | null
  finalUserTurns: string[]
}

export function buildChallengeSuggestionPrompt(ctx: ChallengeContext): string {
  const { topic, summaryText, emotionalTheme, finalUserTurns } = ctx

  const emotionLine = emotionalTheme ? `Emotional theme: ${emotionalTheme}` : ""
  const finalTurnsBlock =
    finalUserTurns.length > 0
      ? `What the person said near the end:\n${finalUserTurns
          .map((t, i) => `${i + 1}. "${t.slice(0, 140)}"`)
          .join("\n")}`
      : ""

  return `You generate 2–3 gentle, first-person action suggestions for someone who has just completed a personal reflection.

These are NOT tasks or advice. They are soft intentions the person might choose to explore.

━━ REFLECTION CONTEXT ━━
Topic: "${topic}"
How the person summarised it: "${summaryText}"
${emotionLine}
${finalTurnsBlock}

━━ RULES ━━
• Every suggestion is written in first person
• Begin each with one of: "One thing I want to try…", "A small step I could take…", "Something I want to express or test…", "One thing I want to notice…"
• Keep each to 1 sentence, 10–25 words
• Suggestions must connect specifically to this reflection — reference the topic, emotion, or something the person actually said
• Make them small and concrete where possible — something reachable in the next few days
• Time-bound where it fits naturally (e.g. "…before the end of this week")
• No advice language: no "you should", "you need to", "make sure to", "try to"
• No praise, no judgment, no clinical language

━━ OUTPUT — valid JSON, no markdown fences ━━
{
  "suggestions": [
    "<first suggestion>",
    "<second suggestion>",
    "<optional third suggestion>"
  ]
}
Return 2 suggestions if the reflection is thin; 3 if it is rich enough to support a third distinct intention.`
}

const CHALLENGE_FORBIDDEN = [
  "you should", "you need to", "make sure", "try to",
  "anxiety", "depression", "trauma", "diagnosis",
]

export function validateChallengeSuggestions(suggestions: string[]): string[] {
  if (suggestions.length < 2) return ["fewer than 2 suggestions returned"]
  const violations: string[] = []
  suggestions.forEach((s, i) => {
    const lower = s.toLowerCase()
    const words = s.trim().split(/\s+/).length
    if (words < 8) violations.push(`suggestion ${i + 1}: too short`)
    if (words > 35) violations.push(`suggestion ${i + 1}: too long`)
    for (const phrase of CHALLENGE_FORBIDDEN) {
      if (lower.includes(phrase)) violations.push(`suggestion ${i + 1}: forbidden phrase "${phrase}"`)
    }
  })
  return violations
}

function makeChallengeFallbacks(ctx: ChallengeContext): string[] {
  const { topic, emotionalTheme } = ctx
  return [
    `One thing I want to try is having a small, honest conversation about ${topic} with someone I trust.`,
    `A small step I could take is noticing when ${emotionalTheme ?? "this feeling"} comes up for me around ${topic} and pausing before reacting.`,
  ]
}

export async function callChallengeSuggestions(
  ctx: ChallengeContext,
): Promise<{ suggestions: string[] }> {
  if (isStub) {
    await new Promise(r => setTimeout(r, 600))
    return { suggestions: makeChallengeFallbacks(ctx) }
  }

  const client = getClient()

  const tryOnce = async (): Promise<string[] | null> => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: CHALLENGE_MAX_TOKENS,
      system: buildChallengeSuggestionPrompt(ctx),
      messages: [{ role: "user", content: "Generate the suggestions now." }],
    })
    const raw = response.content[0].type === "text" ? response.content[0].text : ""
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    try {
      const obj = JSON.parse(cleaned) as { suggestions?: unknown }
      if (Array.isArray(obj.suggestions)) {
        const valid = (obj.suggestions as unknown[]).filter(
          (s): s is string => typeof s === "string" && s.trim().length > 0,
        )
        if (valid.length >= 2) return valid.slice(0, 3)
      }
    } catch { /* fall through */ }
    return null
  }

  let parsed = await tryOnce()
  if (!parsed) parsed = await tryOnce()
  if (!parsed) {
    console.warn("[challenge] Fallback — could not parse suggestions.")
    return { suggestions: makeChallengeFallbacks(ctx) }
  }

  const violations = validateChallengeSuggestions(parsed)
  if (violations.length > 0) {
    console.warn("[challenge] Suggestion violations:", violations)
    // Still return them — minor violations are acceptable for suggestions
  }

  return { suggestions: parsed }
}
