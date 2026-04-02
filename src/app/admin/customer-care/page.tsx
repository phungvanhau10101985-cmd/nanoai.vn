import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CustomerCareInboxClient } from '@/app/admin/customer-care/customer-care-inbox-client'
import { PLATFORM_MESSAGING_PARTNER_ID } from '@/lib/messaging/platform-partner'

export const metadata = buildMetadata({
  title: 'Hộp thư chăm sóc khách hàng (nền tảng NanoAI)',
  description:
    'Chỉ hội thoại liên hệ nền tảng NanoAI; tách khỏi inbox từng shop và tin khi bạn là khách của shop.',
  path: '/admin/customer-care',
  noIndex: true,
})

export default async function AdminCustomerCarePage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login?next=/admin/customer-care')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: conversations } = await supabase
    .from('customer_care_conversations')
    .select('*')
    .eq('partner_id', PLATFORM_MESSAGING_PARTNER_ID)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)

  const { t } = getServerDictionary()
  const tc = t.customerCareAdmin

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tc.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{tc.pageDescription}</p>
      </div>
      <CustomerCareInboxClient initialConversations={conversations ?? []} t={tc} />
    </div>
  )
}
