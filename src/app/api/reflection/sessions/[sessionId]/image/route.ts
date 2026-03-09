import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildImagePrompt, generateReflectionImage } from "@/lib/image-gen"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params

  // Load session with ownership check
  const reflectionSession = await prisma.reflectionSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        where: { role: "assistant" },
        select: { emotionLabel: true },
      },
    },
  })

  if (!reflectionSession || reflectionSession.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // If image already generated, return it immediately
  if (reflectionSession.imageUrl) {
    return NextResponse.json({
      imageUrl: reflectionSession.imageUrl,
      imagePrompt: reflectionSession.imagePrompt,
    })
  }

  // Gather emotional themes from assistant messages
  const emotionalThemes = Array.from(
    new Set(
      reflectionSession.messages
        .map(m => m.emotionLabel)
        .filter((e): e is string => !!e),
    ),
  )

  // Load selected summary text
  const selectedSummary = await prisma.reflectionSummary.findFirst({
    where: { sessionId, selected: true },
    select: { text: true },
  })

  const summaryText = selectedSummary?.text ?? reflectionSession.topic

  // Load user's magical mode
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { magicalMode: true },
  })
  const magicalMode = user?.magicalMode ?? "off"

  // Build prompt
  const imagePrompt = buildImagePrompt(
    reflectionSession.topic,
    summaryText,
    emotionalThemes,
    magicalMode,
  )

  // Generate image (non-blocking failure — returns null if API key missing or error)
  let imageUrl: string | null = null
  try {
    imageUrl = await generateReflectionImage(sessionId, imagePrompt)
  } catch {
    // generation failed — return graceful null
  }

  // Persist to DB regardless of outcome (imageUrl may be null)
  if (imageUrl) {
    await prisma.reflectionSession.update({
      where: { id: sessionId },
      data: { imageUrl, imagePrompt },
    })
  }

  return NextResponse.json({ imageUrl, imagePrompt })
}
