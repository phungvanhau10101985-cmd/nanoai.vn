import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CustomerCareInboxClient } from '@/app/admin/customer-care/customer-care-inbox-client'
import {
  fetchPartnerConversationsFromPg,
  type CustomerCareConversationRow,
} from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { PLATFORM_MESSAGING_PARTNER_ID } from '@/lib/messaging/platform-partner'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'

export const metadata = buildMetadata({
  title: 'Hộp thư chăm sóc khách hàng (nền tảng NanoAI)',
  description:
    'Chỉ hội thoại liên hệ nền tảng NanoAI; tách khỏi inbox từng shop và tin khi bạn là khách của shop.',
  path: '/admin/customer-care',
  noIndex: true,
})

export default async function AdminCustomerCarePage() {
  const user = await getUserOrBypass()
  if (!user) redirect('/auth/login?next=/admin/customer-care')
  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') redirect('/')

  let initialConversations: CustomerCareConversationRow[] = []
  if (isPgConfigured()) {
    try {
      const rows = await fetchPartnerConversationsFromPg(PLATFORM_MESSAGING_PARTNER_ID, 100)
      if (rows) initialConversations = rows
    } catch (e) {
      console.warn('[admin customer-care page] PG list failed', e)
    }
  }

  const { t } = getServerDictionary()
  const tc = t.customerCareAdmin

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tc.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{tc.pageDescription}</p>
      </div>
      <CustomerCareInboxClient initialConversations={initialConversations} t={tc} />
    </div>
  )
}
