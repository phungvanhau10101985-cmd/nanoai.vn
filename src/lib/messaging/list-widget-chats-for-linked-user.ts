import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Db = SupabaseClient<Database>

export type WidgetChatListItem = {
  conversationId: string
  shopName: string
  slug: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
}

/**
 * Hội thoại widget đã liên kết user (hosted NanoAI), chỉ shop còn active.
 */
export async function listWidgetChatsForLinkedUser(
  db: Db,
  linkedUserId: string
): Promise<{ items: WidgetChatListItem[]; error: string | null }> {
  const { data: convs, error: cErr } = await db
    .from('customer_care_conversations')
    .select('id, partner_id, last_message_at, last_message_preview')
    .eq('channel', 'widget')
    .eq('linked_user_id', linkedUserId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (cErr) {
    return { items: [], error: cErr.message }
  }
  if (!convs?.length) {
    return { items: [], error: null }
  }

  const partnerIds = [...new Set(convs.map((c) => c.partner_id))]
  const { data: partners, error: pErr } = await db
    .from('messaging_partners')
    .select('id, display_name, slug, is_active')
    .in('id', partnerIds)

  if (pErr) {
    return { items: [], error: pErr.message }
  }

  const partnerMap = new Map((partners ?? []).map((p) => [p.id, p]))

  const items: WidgetChatListItem[] = []
  for (const c of convs) {
    const p = partnerMap.get(c.partner_id)
    if (!p?.slug || p.is_active === false) continue
    items.push({
      conversationId: c.id,
      shopName: p.display_name,
      slug: p.slug,
      lastMessageAt: c.last_message_at,
      lastMessagePreview: c.last_message_preview,
    })
  }

  return { items, error: null }
}
