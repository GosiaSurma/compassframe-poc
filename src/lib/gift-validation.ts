export interface GiftSendState {
  canSend: boolean
  disabledReason: string | null
}

export function getGiftSendState({
  selectedSummaryId,
  recipientId,
  saving,
}: {
  selectedSummaryId: string | null
  recipientId: string | null
  saving: boolean
}): GiftSendState {
  if (saving) {
    return { canSend: false, disabledReason: "Sending…" }
  }
  if (!selectedSummaryId) {
    return { canSend: false, disabledReason: "Select a summary above before sending." }
  }
  if (!recipientId) {
    return { canSend: false, disabledReason: "Select a recipient above to send." }
  }
  return { canSend: true, disabledReason: null }
}
