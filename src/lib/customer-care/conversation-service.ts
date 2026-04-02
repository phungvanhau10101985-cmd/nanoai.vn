import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
import type { CustomerCareChannel } from '@/lib/customer-care/types'

type Db = SupabaseClient<Database>

export async function ensureConversation(
  db: Db,
  params: {
    partnerId: string
    channel: CustomerCareChannel
    externalThreadId: string
    channelExternalRef?: string | null
    customerName?: string | null
    customerAvatarUrl?: string | null
    linkedUserId?: string | null
    metadata?: Json
  }
) {
  const {
    partnerId,
    channel,
    externalThreadId,
    channelExternalRef,
    customerName,
    customerAvatarUrl,
    linkedUserId,
    metadata,
  } = params

  const { data: existing, error: selErr } = await db
    .from('customer_care_conversations')
    .select('id, linked_user_id')
    .eq('partner_id', partnerId)
    .eq('channel', channel)
    .eq('external_thread_id', externalThreadId)
    .maybeSingle()

  if (selErr) {
    console.error('[customer-care] ensureConversation select', selErr)
    return { error: selErr.message }
  }

  if (existing?.id) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (customerName != null && customerName !== '') patch.customer_name = customerName
    if (channelExternalRef != null && channelExternalRef !== '') patch.channel_external_ref = channelExternalRef
    if (
      linkedUserId != null &&
      linkedUserId !== '' &&
      (existing.linked_user_id == null || existing.linked_user_id === '')
    ) {
      patch.linked_user_id = linkedUserId
    }
    if (
      patch.customer_name !== undefined ||
      patch.channel_external_ref !== undefined ||
      patch.linked_user_id !== undefined
    ) {
      await db.from('customer_care_conversations').update(patch).eq('id', existing.id)
    }
    return { conversationId: existing.id }
  }

  const { data: created, error: insErr } = await db
    .from('customer_care_conversations')
    .insert({
      partner_id: partnerId,
      channel,
      external_thread_id: externalThreadId,
      channel_external_ref: channelExternalRef ?? null,
      customer_name: customerName ?? null,
      customer_avatar_url: customerAvatarUrl ?? null,
      linked_user_id: linkedUserId ?? null,
      metadata: metadata ?? {},
      status: 'open',
    })
    .select('id')
    .single()

  if (insErr || !created) {
    console.error('[customer-care] ensureConversation insert', insErr)
    return { error: insErr?.message ?? 'insert failed' }
  }
  return { conversationId: created.id }
}

export async function insertMessage(
  db: Db,
  params: {
    conversationId: string
    direction: 'inbound' | 'outbound'
    body: string
    rawPayload?: Json | null
    senderAdminId?: string | null
  }
) {
  const { data, error } = await db
    .from('customer_care_messages')
    .insert({
      conversation_id: params.conversationId,
      direction: params.direction,
      body: params.body,
      raw_payload: params.rawPayload ?? null,
      sender_admin_id: params.senderAdminId ?? null,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[customer-care] insertMessage', error)
    return { error: error.message }
  }
  if (!data?.id) {
    return { error: 'insert failed' }
  }
  return { ok: true as const, messageId: data.id }
}
