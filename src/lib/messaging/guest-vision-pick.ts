import type { Json } from '@/types/database.types'
import {
  fetchConversationUiLocaleFromPg,
  fetchGuestWidgetConversationIdFromPg,
  fetchCustomerCareMessageByIdForConversationPg,
  updateCustomerCareMessageRawPayloadPg,
} from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { cancelPendingAiJobsForConversation, handlePartnerInboundForAi } from '@/lib/messaging/partner-ai-inbound'
import { latestInboundTextForPartnerAi } from '@/lib/messaging/guest-chat-image'
import { normalizeWebLocale } from '@/lib/i18n/config'

type GuestMessageVisionPayload = {
  vision_candidates?: Array<{
    inventoryId: string
    name: string
    sku: string | null
  }>
  vision_pick_required?: boolean
}

export async function executeGuestVisionPick(input: {
  partnerId: string
  externalThreadId: string
  messageId: string
  inventoryId: string
}): Promise<
  | { ok: true; shopTyping?: { maxWaitMs: number } }
  | { error: string; notFound?: boolean; badRequest?: boolean; serviceUnavailable?: boolean }
> {
  const { partnerId, externalThreadId, messageId, inventoryId } = input

  if (!isPgConfigured()) {
    return { error: 'Server database is not configured.', serviceUnavailable: true }
  }

  let convId: string | null = null
  try {
    convId = await fetchGuestWidgetConversationIdFromPg(partnerId, externalThreadId)
  } catch (e) {
    console.warn('[guest-vision-pick] PG conv lookup failed', e)
  }

  if (!convId) return { error: 'Not found.', notFound: true }

  let msg: {
    id: string
    direction: string
    body: string
    raw_payload: Json | null
    conversation_id: string
  } | null = null
  try {
    const row = await fetchCustomerCareMessageByIdForConversationPg(messageId, convId)
    if (row) {
      msg = {
        id: row.id,
        direction: row.direction,
        body: row.body,
        raw_payload: row.raw_payload,
        conversation_id: row.conversation_id,
      }
    }
  } catch (e) {
    console.warn('[guest-vision-pick] PG message load failed', e)
  }
  if (!msg) {
    return { error: 'Not found.', notFound: true }
  }

  if (msg.direction !== 'inbound') {
    return { error: 'Not found.', notFound: true }
  }

  const pl = msg.raw_payload as GuestMessageVisionPayload | null
  if (!Array.isArray(pl?.vision_candidates) || pl.vision_candidates.length === 0) {
    return { error: 'Invalid message state.', badRequest: true }
  }

  const picked = pl.vision_candidates.find((c) => c.inventoryId === inventoryId)
  if (!picked) {
    return { error: 'Product not in suggestions.', badRequest: true }
  }

  const label = [picked.name?.trim(), picked.sku?.trim() ? `(SKU ${picked.sku.trim()})` : '']
    .filter(Boolean)
    .join(' ')

  const nextPayload = {
    ...(typeof msg.raw_payload === 'object' && msg.raw_payload ? msg.raw_payload : {}),
    vision_pick_required: true,
    vision_selected_inventory_id: inventoryId,
    vision_selected_product_label: label,
    vision_selected_at: new Date().toISOString(),
  } as Json

  let updated = false
  try {
    updated = await updateCustomerCareMessageRawPayloadPg(messageId, nextPayload)
  } catch (e) {
    console.warn('[guest-vision-pick] PG update payload failed', e)
  }
  if (!updated) {
    return { error: 'Could not update message.' }
  }

  // Ensure stale pending jobs are removed before scheduling the selected-product reply.
  await cancelPendingAiJobsForConversation(msg.conversation_id)

  let widgetUiLocale: string | null = null
  try {
    const raw = await fetchConversationUiLocaleFromPg(msg.conversation_id)
    widgetUiLocale = normalizeWebLocale(raw ?? null)
  } catch {
    widgetUiLocale = null
  }

  const hint = await handlePartnerInboundForAi({
    partnerId,
    conversationId: msg.conversation_id,
    messageId,
    inboundBody: latestInboundTextForPartnerAi(msg.body, nextPayload),
    channel: 'widget',
    // Vision pick is a confirmed user action; run immediately and bypass burst merge delay.
    scheduleAiAfterSeconds: 0,
    widgetUiLocale,
  })

  return {
    ok: true,
    shopTyping: hint.show ? { maxWaitMs: hint.maxWaitMs } : undefined,
  }
}
