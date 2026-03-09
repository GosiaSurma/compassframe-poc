import OpenAI from "openai"

// ── Prompt builder ─────────────────────────────────────────────────────────

export function buildImagePrompt(
  topic: string,
  summaryText: string,
  emotionalThemes: string[],
  magicalMode: string,
): string {
  const emotion = emotionalThemes.length > 0 ? emotionalThemes.slice(0, 2).join(", ") : "quiet"
  // Take first sentence of summary as the core meaning phrase
  const phrase = summaryText.split(/[.!?]/)[0]?.trim() ?? summaryText.slice(0, 80)

  switch (magicalMode) {
    case "full":
      return (
        `Ethereal symbolic scene. ${phrase}. ` +
        `Elemental imagery reflecting ${emotion}. ` +
        `Rich dreamlike atmosphere, luminous quality, depth and wonder. ` +
        `No people, no faces, no text. Fine art illustration.`
      )
    case "light":
      return (
        `Soft symbolic illustration. ${topic} as metaphor. ` +
        `${emotion} quality. Gentle watercolor style, muted tones, subtle symbolism. ` +
        `No people, no faces, no text.`
      )
    default:
      // "off" — minimal abstract
      return (
        `Abstract minimal composition. Inspired by: ${topic}. ` +
        `Mood: ${emotion}. Soft geometric forms, muted palette. ` +
        `Clean, calm, contemplative. No people, no faces, no text.`
      )
  }
}

// ── Image generator ────────────────────────────────────────────────────────

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

/**
 * Generates an image for a reflection session via DALL-E 3.
 * Returns the remote image URL directly (valid ~1 hour) or null if unavailable/failed.
 * Storing to filesystem is skipped — incompatible with read-only serverless environments.
 */
export async function generateReflectionImage(
  _sessionId: string,
  prompt: string,
): Promise<string | null> {
  const client = getOpenAI()
  if (!client) return null  // no API key → silently skip

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
  })

  return response.data?.[0]?.url ?? null
}
