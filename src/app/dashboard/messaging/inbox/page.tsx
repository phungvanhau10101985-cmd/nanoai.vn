import { fetchMessagingPartnerByIdFromPg, fetchMessagingPartnersForDashboardFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getServerDictionary } from '@/lib/i18n/server'
import { PartnerMessagingInboxClient } from '../partner-messaging-inbox-client'
import { MessagingInboxScrollLock } from '../messaging-inbox-scroll-lock'

export default async function DashboardMessagingInboxPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { t } = getServerDictionary()
  const pm = t.partnerMessaging
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  const sp = searchParams ? await searchParams : {}
  const partnerRaw = sp?.partner
  const requestedPartner = Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw
  const requestedPartnerId = isValidUuidString(String(requestedPartner ?? '').trim())
    ? String(requestedPartner).trim()
    : ''
  const conversationRaw = sp?.conversation
  const requestedConversation = Array.isArray(conversationRaw) ? conversationRaw[0] : conversationRaw
  const requestedConversationId = isValidUuidString(String(requestedConversation ?? '').trim())
    ? String(requestedConversation).trim()
    : ''

  let rows: NonNullable<Awaited<ReturnType<typeof fetchMessagingPartnersForDashboardFromPg>>> = []
  let hotelCount = 0
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersForDashboardFromPg(user.id)
    if (fromPg !== null) {
      hotelCount = fromPg.filter((p) => p.industry_key === 'hotel').length
      rows = fromPg.filter((p) => p.industry_key !== 'hotel')
    }
  }

  let orderedRows = rows
  if (requestedPartnerId && rows.some((p) => p.id === requestedPartnerId)) {
    const selected = await fetchMessagingPartnerByIdFromPg(requestedPartnerId)
    if (selected?.industry_key === 'hotel') {
      orderedRows = rows
    } else {
      orderedRows = rows.sort((a, b) => (a.id === requestedPartnerId ? -1 : b.id === requestedPartnerId ? 1 : 0))
    }
  }

  return (
    <MessagingInboxScrollLock>
      <div className="mx-auto flex h-[calc(100dvh-4.25rem)] max-h-[100dvh] w-full max-w-7xl min-h-0 flex-col overflow-hidden px-2 pb-1 pt-2 sm:px-4 sm:pb-2 sm:pt-3 md:h-[calc(100dvh-4.75rem)] md:px-6 md:pb-3 md:pt-4 lg:px-8 max-md:h-full max-md:max-h-none max-md:flex-1 max-md:px-0 max-md:pb-0 max-md:pt-0">
        <div className="flex min-h-0 flex-1 flex-col">
          <PartnerMessagingInboxClient
            initialPartners={orderedRows ?? []}
            hotelCount={hotelCount}
            t={pm}
            initialPartnerId={requestedPartnerId || null}
            initialConversationId={requestedConversationId || null}
          />
        </div>
      </div>
    </MessagingInboxScrollLock>
  )
}

