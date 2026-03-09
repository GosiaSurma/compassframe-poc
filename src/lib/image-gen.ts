import OpenAI from "openai"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import https from "https"
import http from "http"

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

function downloadToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http
    lib.get(url, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => chunks.push(chunk))
      res.on("end", () => resolve(Buffer.concat(chunks)))
      res.on("error", reject)
    }).on("error", reject)
  })
}

/**
 * Generates an image for a reflection session and saves it to public/generated/{sessionId}.png.
 * Returns the relative URL path (e.g. "/generated/abc.png"), or null if unavailable/failed.
 */
export async function generateReflectionImage(
  sessionId: string,
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

  const remoteUrl = response.data?.[0]?.url
  if (!remoteUrl) return null

  const buffer = await downloadToBuffer(remoteUrl)
  const dir = join(process.cwd(), "public", "generated")
  await mkdir(dir, { recursive: true })
  const filename = `${sessionId}.png`
  await writeFile(join(dir, filename), buffer)

  return `/generated/${filename}`
}
