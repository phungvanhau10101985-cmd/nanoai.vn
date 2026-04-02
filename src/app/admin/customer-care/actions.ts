'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { sendFacebookMessengerText } from '@/lib/customer-care/facebook-messenger'
import { sendZaloOaText } from '@/lib/customer-care/zalo-oa'
import { insertMessage } from '@/lib/customer-care/conversation-service'
import { getFacebookSendToken, getZaloSendToken } from '@/lib/messaging/partner-channels-db'
import { cancelPendingAiJobsForConversation } from '@/lib/messaging/partner-ai-inbound'
import { PLATFORM_MESSAGING_PARTNER_ID } from '@/lib/messaging/platform-partner'

async function requireAdmin() {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Authentication required.')
  if ('error' in result) return { error: result.error }
  const { user } = result
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Permission denied.' }
  return { user, supabase }
}

export async function listCustomerCareConversations() {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth
  /** Chỉ inbox nền tảng NanoAI — tách khỏi inbox từng shop (/dashboard/messaging) và khỏi tin user là khách (/messaging/my-chats). */
  const { data, error } = await supabase
    .from('customer_care_conversations')
    .select('*')
    .eq('partner_id', PLATFORM_MESSAGING_PARTNER_ID)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)
  if (error) return { error: error.message }
  return { rows: data ?? [] }
}

export async function listCustomerCareMessages(conversationId: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth
  const { data: conv } = await supabase
    .from('customer_care_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('partner_id', PLATFORM_MESSAGING_PARTNER_ID)
    .maybeSingle()
  if (!conv) return { error: 'Conversation not found.' }
  const { data, error } = await supabase
    .from('customer_care_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) return { error: error.message }
  return { rows: data ?? [] }
}

export async function sendCustomerCareReply(conversationId: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return { error: 'Empty message.' }
  if (trimmed.length > 8000) return { error: 'Message too long.' }

  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth

  const { data: conv, error: convErr } = await supabase
    .from('customer_care_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('partner_id', PLATFORM_MESSAGING_PARTNER_ID)
    .single()

  if (convErr || !conv) return { error: 'Conversation not found.' }

  await cancelPendingAiJobsForConversation(conversationId)

  const externalId = conv.external_thread_id

  if (conv.channel === 'facebook') {
    let pageToken: string | null = null
    try {
      const svc = createServiceRoleClient()
      const pageId = conv.channel_external_ref
      if (pageId) {
        const r = await getFacebookSendToken(svc, conv.partner_id, pageId)
        if (r.error) return { error: r.error }
        pageToken = r.token ?? null
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
      const svc = createServiceRoleClient()
      const r = await getZaloSendToken(svc, conv.partner_id)
      if (r.error) return { error: r.error }
      zaloToken = r.token ?? null
    } catch {
      return { error: 'Server configuration error.' }
    }
    if (!zaloToken) zaloToken = process.env.ZALO_OA_ACCESS_TOKEN ?? null
    if (!zaloToken) return { error: 'No Zalo OA access token configured for this thread.' }
    const sent = await sendZaloOaText(externalId, trimmed, zaloToken)
    if ('error' in sent) return { error: sent.error }
  }

  const ins = await insertMessage(supabase, {
    conversationId,
    direction: 'outbound',
    body: trimmed,
    senderAdminId: user.id,
  })
  if ('error' in ins) return { error: ins.error }

  revalidatePath('/admin/customer-care')
  return { ok: true as const }
}
