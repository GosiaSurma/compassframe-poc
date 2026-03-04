import { InsightCard } from "./InsightCard"

export interface MessageData {
  id: string
  role: string
  content: string
  insightText: string | null
  insightResponse: string | null
}

interface Props {
  message: MessageData
  responded: boolean
  onInsightResponse: (messageId: string, response: "resonates" | "not_quite" | "clarify") => void
  onClarify: () => void
}

export function ChatBubble({ message, responded, onInsightResponse, onClarify }: Props) {
  const isUser = message.role === "user"

  return (
    <div className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5 ${
          isUser ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-700"
        }`}
      >
        {isUser ? "You" : "✦"}
      </div>

      {/* Bubble + optional insight */}
      <div className={`flex flex-col gap-2 max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-brand-600 text-white rounded-tr-sm"
              : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {message.content}
        </div>

        {!isUser && message.insightText && (
          <InsightCard
            text={message.insightText}
            messageId={message.id}
            responded={responded}
            currentResponse={message.insightResponse}
            onRespond={(id, r) => {
              onInsightResponse(id, r)
              if (r === "clarify") onClarify()
            }}
          />
        )}
      </div>
    </div>
  )
}
