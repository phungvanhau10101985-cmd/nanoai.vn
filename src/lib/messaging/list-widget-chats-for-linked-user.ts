import {
  fetchWidgetConversationsForLinkedUserFromPg,
  linkWidgetConversationsByGuestAccountEmailFromPg,
} from '@/lib/db/customer-care-pg'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'

export type WidgetChatListItem = {
  conversationId: string
  shopName: string
  slug: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
}

/**
 * Hội thoại widget đã liên kết user (hosted NanoAI), chỉ shop còn active.
 * Chỉ Postgres — không còn REST/HTTP client cũ cho bảng này.
 */
export async function listWidgetChatsForLinkedUser(
  linkedUserId: string,
  options?: { accountEmailNormalized?: string | null }
): Promise<{ items: WidgetChatListItem[]; error: string | null }> {
  if (!isPgConfigured()) {
    return { items: [], error: 'Database not configured.' }
  }

  const email = String(options?.accountEmailNormalized ?? '')
    .trim()
    .toLowerCase()
  if (email) {
    await linkWidgetConversationsByGuestAccountEmailFromPg(linkedUserId, email)
  }

  const convs = await fetchWidgetConversationsForLinkedUserFromPg(linkedUserId)
  if (convs === null) {
    return { items: [], error: 'Could not load conversations.' }
  }

  if (!convs.length) {
    return { items: [], error: null }
  }

  const partnerIds = [...new Set(convs.map((c) => c.partner_id))]
  const partners = await fetchMessagingPartnersByIdsFromPg(partnerIds)
  if (partners === null) {
    return { items: [], error: 'Could not load shop details.' }
  }

  const partnerMap = new Map(partners.map((p) => [p.id, p]))

  const items: WidgetChatListItem[] = []
  for (const c of convs) {
    const p = partnerMap.get(c.partner_id)
    if (!p?.slug || p.is_active === false) continue
    if (p.industry_key === 'hotel') continue
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
