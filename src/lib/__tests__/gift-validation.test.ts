import { describe, it, expect } from "vitest"
import { getGiftSendState } from "../gift-validation"

const SUMMARY_ID = "sum_1"
const RECIPIENT_ID = "usr_1"

describe("getGiftSendState", () => {
  it("blocks when saving — shows Sending…", () => {
    const result = getGiftSendState({ selectedSummaryId: SUMMARY_ID, recipientId: RECIPIENT_ID, saving: true })
    expect(result.canSend).toBe(false)
    expect(result.disabledReason).toBe("Sending…")
  })

  it("saving takes precedence over missing recipient", () => {
    const result = getGiftSendState({ selectedSummaryId: SUMMARY_ID, recipientId: null, saving: true })
    expect(result.canSend).toBe(false)
    expect(result.disabledReason).toBe("Sending…")
  })

  it("blocks when no summary selected", () => {
    const result = getGiftSendState({ selectedSummaryId: null, recipientId: RECIPIENT_ID, saving: false })
    expect(result.canSend).toBe(false)
    expect(result.disabledReason).toMatch(/summary/i)
  })

  it("blocks when no recipient selected", () => {
    const result = getGiftSendState({ selectedSummaryId: SUMMARY_ID, recipientId: null, saving: false })
    expect(result.canSend).toBe(false)
    expect(result.disabledReason).toMatch(/recipient/i)
  })

  it("allows sending when summary and recipient are set and not saving", () => {
    const result = getGiftSendState({ selectedSummaryId: SUMMARY_ID, recipientId: RECIPIENT_ID, saving: false })
    expect(result.canSend).toBe(true)
    expect(result.disabledReason).toBeNull()
  })

  it("title and message are not required — canSend without them", () => {
    // title/message are optional fields not part of the send gate
    const result = getGiftSendState({ selectedSummaryId: SUMMARY_ID, recipientId: RECIPIENT_ID, saving: false })
    expect(result.canSend).toBe(true)
  })
})
