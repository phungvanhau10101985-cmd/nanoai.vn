import type { Json } from '@/types/database.types'

type JsonObject = Record<string, unknown>

function jsonObject(raw: Json | null | undefined): JsonObject | null {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as JsonObject)
    : null
}

/** Latest outbound still has another text/image payload coming from the same shop reply. */
export function partnerAiPayloadHasPendingOutbound(raw: Json | null | undefined): boolean {
  const payload = jsonObject(raw)
  if (!payload) return false
  if (payload.ai_reply_continuation === true) return true
  const pending = payload.partner_ai_followup_pending
  return pending !== null && typeof pending === 'object' && !Array.isArray(pending)
}

export function partnerAiPayloadContinuationWaitMs(raw: Json | null | undefined): number | null {
  const payload = jsonObject(raw)
  const value = Number(payload?.ai_reply_continuation_wait_ms)
  return Number.isFinite(value) && value > 0 ? Math.min(10 * 60_000, Math.ceil(value)) : null
}

export function withPartnerAiReplyContinuation(raw: Json, waitMs?: number): Json {
  const payload = jsonObject(raw)
  return {
    ...(payload ?? {}),
    ai_reply_continuation: true,
    ...(Number.isFinite(waitMs) && Number(waitMs) > 0
      ? { ai_reply_continuation_wait_ms: Math.ceil(Number(waitMs)) }
      : {}),
  } as Json
}
