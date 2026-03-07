"use client"

import { useState } from "react"
import { Gift } from "lucide-react"
import { cn } from "@/lib/utils"

interface GiftItem {
  id: string
  fromName: string
  title: string | null
  message: string | null
  readAt: string | null
  createdAt: string
  topic: string | null
  summaryText: string | null
}

interface Props {
  gifts: GiftItem[]
}

export function GiftsClient({ gifts: initial }: Props) {
  const [gifts, setGifts] = useState(initial)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function handleExpand(id: string) {
    const already = expanded === id
    setExpanded(already ? null : id)

    if (!already) {
      const gift = gifts.find(g => g.id === id)
      if (gift && !gift.readAt) {
        await fetch(`/api/gifts/${id}/read`, { method: "PATCH" })
        setGifts(prev =>
          prev.map(g => (g.id === id ? { ...g, readAt: new Date().toISOString() } : g)),
        )
      }
    }
  }

  if (gifts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Gifts</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Gift className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No gifts yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Gifts appear here when someone shares a reflection with you.
          </p>
        </div>
      </div>
    )
  }

  const unread = gifts.filter(g => !g.readAt).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Gifts</h1>
        {unread > 0 && (
          <span className="bg-brand-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            {unread} new
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {gifts.map(gift => {
          const isOpen = expanded === gift.id
          const isNew = !gift.readAt
          const subtitle = gift.title ?? (gift.topic ? `Reflection on: ${gift.topic}` : "Shared a reflection")

          return (
            <li
              key={gift.id}
              className={cn(
                "rounded-2xl border-2 transition-all overflow-hidden cursor-pointer",
                isNew ? "border-brand-200 bg-brand-50" : "border-gray-100 bg-white",
              )}
              onClick={() => handleExpand(gift.id)}
            >
              {/* Collapsed header */}
              <div className="flex items-center gap-4 p-5">
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {gift.fromName}
                    </p>
                    {isNew && (
                      <span className="inline-block bg-brand-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-semibold">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    "text-xs truncate mt-0.5",
                    gift.title ? "text-brand-600 italic" : "text-gray-400",
                  )}>
                    {subtitle}
                    {" · "}
                    {new Date(gift.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-gray-300 text-sm shrink-0">{isOpen ? "▲" : "▼"}</span>
              </div>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-3">
                  {/* Framing line (if different from topic) */}
                  {gift.title && (
                    <div className="flex items-center gap-2 pb-1">
                      <span className="text-xs text-gray-400">Reflection on:</span>
                      <span className="text-xs text-gray-600">{gift.topic ?? "—"}</span>
                    </div>
                  )}

                  {gift.summaryText && (
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      <p className="text-xs font-medium text-gray-400 mb-1.5">Their reflection</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{gift.summaryText}</p>
                    </div>
                  )}

                  {gift.message && (
                    <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                      <p className="text-xs font-medium text-amber-500 mb-1.5">Personal note</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{gift.message}</p>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
