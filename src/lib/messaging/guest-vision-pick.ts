import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
import { handlePartnerInboundForAi } from '@/lib/messaging/partner-ai-inbound'
import { latestInboundTextForPartnerAi } from '@/lib/messaging/guest-chat-image'

type GuestMessageVisionPayload = {
  vision_candidates?: Array<{
    inventoryId: string
    name: string
    sku: string | null
  }>
  vision_pick_required?: boolean
}

type Db = SupabaseClient<Database>

export async function executeGuestVisionPick(
  db: Db,
  input: {
    partnerId: string
    externalThreadId: string
    messageId: string
    inventoryId: string
  }
): Promise<
  | { ok: true; shopTyping?: { maxWaitMs: number } }
  | { error: string; notFound?: boolean; badRequest?: boolean }
> {
  const { partnerId, externalThreadId, messageId, inventoryId } = input

  const { data: conv } = await db
    .from('customer_care_conversations')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('channel', 'widget')
    .eq('external_thread_id', externalThreadId)
    .maybeSingle()

  if (!conv) return { error: 'Not found.', notFound: true }

  const { data: msg, error: msgErr } = await db
    .from('customer_care_messages')
    .select('id, direction, body, raw_payload, conversation_id')
    .eq('id', messageId)
    .eq('conversation_id', conv.id)
    .maybeSingle()

  if (msgErr || !msg || msg.direction !== 'inbound') {
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
  } as Json

  const { error: upErr } = await db.from('customer_care_messages').update({ raw_payload: nextPayload }).eq('id', messageId)
  if (upErr) return { error: upErr.message }

  const hint = await handlePartnerInboundForAi(db, {
    partnerId,
    conversationId: msg.conversation_id,
    messageId,
    inboundBody: latestInboundTextForPartnerAi(msg.body, nextPayload),
    channel: 'widget',
  })

  return {
    ok: true,
    shopTyping: hint.show ? { maxWaitMs: hint.maxWaitMs } : undefined,
  }
}
