import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Db = SupabaseClient<Database>

export async function mergeGuestSessionConversationToAccount(
  db: Db,
  partnerId: string,
  sessionId: string,
  guestAccountId: string
) {
  const oldConv = await db
    .from('customer_care_conversations')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('channel', 'widget')
    .eq('external_thread_id', sessionId)
    .maybeSingle()
  if (oldConv.error || !oldConv.data?.id) return

  const targetConv = await db
    .from('customer_care_conversations')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('channel', 'widget')
    .eq('external_thread_id', guestAccountId)
    .maybeSingle()
  if (targetConv.error) return

  if (!targetConv.data?.id) {
    await db
      .from('customer_care_conversations')
      .update({ external_thread_id: guestAccountId, updated_at: new Date().toISOString() } as never)
      .eq('id', oldConv.data.id)
    return
  }

  if (targetConv.data.id === oldConv.data.id) return

  await db
    .from('customer_care_messages')
    .update({ conversation_id: targetConv.data.id } as never)
    .eq('conversation_id', oldConv.data.id)
  await db.from('customer_care_conversations').delete().eq('id', oldConv.data.id)
}
