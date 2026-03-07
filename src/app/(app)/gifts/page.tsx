import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GiftsClient } from "./gifts-client"

export default async function GiftsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const gifts = await prisma.gift.findMany({
    where: { toUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      fromUser: { select: { name: true, email: true } },
      session: {
        select: {
          topic: true,
          summaries: {
            where: { selected: true },
            select: { text: true },
          },
        },
      },
    },
  })

  return (
    <GiftsClient
      gifts={gifts.map(g => ({
        id: g.id,
        fromName: g.fromUser.name ?? g.fromUser.email,
        title: g.title,
        message: g.message,
        readAt: g.readAt?.toISOString() ?? null,
        createdAt: g.createdAt.toISOString(),
        topic: g.session?.topic ?? null,
        summaryText: g.session?.summaries[0]?.text ?? null,
      }))}
    />
  )
}
