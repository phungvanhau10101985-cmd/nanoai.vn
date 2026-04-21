/**
 * Hospitality-facing conversation persistence.
 *
 * This is the ONLY module inside the hospitality vertical that is allowed to
 * reach into the shared `@/lib/customer-care/*` services and the
 * `customer_care_*` tables (via `@/lib/db/customer-care-pg`). Every other
 * hospitality module MUST go through the helpers here, so the hotel flow can
 * migrate to a separate conversation store / schema later without touching
 * fashion code paths.
 */
import type { Json } from '@/types/database.types'
import type { CustomerCareChannel } from '@/lib/customer-care/types'
import {
  ensureConversation,
  insertMessage,
} from '@/lib/customer-care/conversation-service'
import {
  fetchConversationFullForPartnerFromPg,
  fetchGuestWidgetConversationIdFromPg,
  fetchGuestWidgetMessagesSubsetFromPg,
  insertMessagePg,
  listPartnerConversationsFromPg,
  listPartnerMessagesBundleFromPg,
  mergeConversationUiLocaleFromPg,
} from '@/lib/db/customer-care-pg'

export type HospitalityMessageDirection = 'inbound' | 'outbound'

export async function ensureHospitalityConversation(params: {
  partnerId: string
  channel: CustomerCareChannel
  externalThreadId: string
  channelExternalRef?: string | null
  customerName?: string | null
  customerAvatarUrl?: string | null
  linkedUserId?: string | null
  metadata?: Json
}): Promise<{ conversationId: string } | { error: string }> {
  return ensureConversation(params)
}

export async function insertHospitalityMessage(params: {
  conversationId: string
  direction: HospitalityMessageDirection
  body: string
  rawPayload?: Json | null
  senderAdminId?: string | null
  landingSourceUrl?: string | null
}): Promise<{ ok: true; messageId: string } | { error: string }> {
  return insertMessage(params)
}

/**
 * Low-level variant used by connector plumbing (e.g. WhatsApp inbound/outbound)
 * that wants direct boolean feedback without going through the messaging
 * service wrapper.
 */
export async function insertHospitalityMessageRaw(params: {
  conversationId: string
  direction: HospitalityMessageDirection
  body: string
  rawPayload?: Json | null
  senderAdminId?: string | null
  landingSourceUrl?: string | null
}): Promise<{ ok: true; messageId: string } | null> {
  return insertMessagePg(params)
}

export async function mergeHospitalityConversationUiLocale(
  conversationId: string,
  uiLocale: string
): Promise<boolean> {
  return mergeConversationUiLocaleFromPg(conversationId, uiLocale)
}

export async function fetchHospitalityGuestConversationId(
  partnerId: string,
  externalThreadId: string
): Promise<string | null> {
  return fetchGuestWidgetConversationIdFromPg(partnerId, externalThreadId)
}

export async function fetchHospitalityGuestMessagesSubset(conversationId: string) {
  return fetchGuestWidgetMessagesSubsetFromPg(conversationId)
}

export async function listHospitalityPartnerConversations(partnerId: string, limit = 50) {
  return listPartnerConversationsFromPg(partnerId, limit)
}

export async function listHospitalityPartnerConversationMessages(
  partnerId: string,
  conversationId: string
) {
  return listPartnerMessagesBundleFromPg(partnerId, conversationId)
}

export async function insertHospitalityPartnerOutboundMessage(params: {
  partnerId: string
  conversationId: string
  body: string
  senderAdminId?: string | null
}) {
  const conv = await fetchConversationFullForPartnerFromPg(params.partnerId, params.conversationId)
  if (!conv || conv === 'not_found') return null
  return insertHospitalityMessage({
    conversationId: params.conversationId,
    direction: 'outbound',
    body: params.body,
    senderAdminId: params.senderAdminId ?? null,
  })
}
