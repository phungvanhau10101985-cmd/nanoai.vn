'use server'

import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import {
  fetchConversationFullForPartnerFromPg,
  fetchPartnerConversationsFromPg,
  insertMessagePg,
  listPartnerMessagesBundleFromPg,
} from '@/lib/db/customer-care-pg'
import { getFacebookSendTokenFromPg, getZaloSendTokenFromPg } from '@/lib/db/messaging-partner-channels-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { sendFacebookMessengerText } from '@/lib/customer-care/facebook-messenger'
import { sendZaloOaText } from '@/lib/customer-care/zalo-oa'
import { cancelPendingAiJobsForConversation } from '@/lib/messaging/partner-ai-inbound'
import { PLATFORM_MESSAGING_PARTNER_ID } from '@/lib/messaging/platform-partner'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import type { Database } from '@/types/database.types'

async function requireAdmin() {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') return { error: 'Permission denied.' }
  return { user }
}

export async function listCustomerCareConversations() {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  if (!isPgConfigured()) {
    return { error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }
  }
  try {
    const rows = await fetchPartnerConversationsFromPg(PLATFORM_MESSAGING_PARTNER_ID, 100)
    if (rows === null) return { error: 'Không tải được danh sách hội thoại.' }
    return { rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}

export async function listCustomerCareMessages(conversationId: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  if (!isPgConfigured()) {
    return { error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }
  }
  try {
    const bundle = await listPartnerMessagesBundleFromPg(PLATFORM_MESSAGING_PARTNER_ID, conversationId)
    if (bundle === 'not_found') return { error: 'Conversation not found.' }
    if (bundle === null) return { error: 'Không tải được tin nhắn.' }
    return { rows: bundle.rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}

export async function sendCustomerCareReply(conversationId: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return { error: 'Empty message.' }
  if (trimmed.length > 8000) return { error: 'Message too long.' }

  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth

  if (!isPgConfigured()) {
    return { error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }
  }

  let conv: Database['public']['Tables']['customer_care_conversations']['Row'] | null = null
  try {
    const c = await fetchConversationFullForPartnerFromPg(PLATFORM_MESSAGING_PARTNER_ID, conversationId)
    if (c === 'not_found') return { error: 'Conversation not found.' }
    if (c === null) return { error: 'Không đọc được hội thoại.' }
    conv = c
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
  if (!conv) return { error: 'Conversation not found.' }

  await cancelPendingAiJobsForConversation(conversationId)

  const externalId = conv.external_thread_id

  if (conv.channel === 'facebook') {
    let pageToken: string | null = null
    try {
      const pageId = conv.channel_external_ref
      if (pageId) {
        pageToken = await getFacebookSendTokenFromPg(conv.partner_id, pageId)
      }
    } catch {
      return { error: 'Server configuration error.' }
    }
    if (!pageToken) pageToken = process.env.FACEBOOK_MESSENGER_PAGE_ACCESS_TOKEN ?? null
    if (!pageToken) return { error: 'No Facebook Page access token configured for this thread.' }
    const sent = await sendFacebookMessengerText(externalId, trimmed, pageToken)
    if ('error' in sent) return { error: sent.error }
  } else if (conv.channel === 'zalo') {
    let zaloToken: string | null = null
    try {
      zaloToken = await getZaloSendTokenFromPg(conv.partner_id)
    } catch {
      return { error: 'Server configuration error.' }
    }
    if (!zaloToken) zaloToken = process.env.ZALO_OA_ACCESS_TOKEN ?? null
    if (!zaloToken) return { error: 'No Zalo OA access token configured for this thread.' }
    const sent = await sendZaloOaText(externalId, trimmed, zaloToken)
    if ('error' in sent) return { error: sent.error }
  }

  const ins = await insertMessagePg({
    conversationId,
    direction: 'outbound',
    body: trimmed,
    senderAdminId: user.id,
  })
  if (!ins) return { error: 'Không lưu được tin nhắn.' }

  revalidatePath('/admin/customer-care')
  return { ok: true as const }
}
