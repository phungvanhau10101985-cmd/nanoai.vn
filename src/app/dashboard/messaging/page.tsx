import { createClient } from '@/lib/supabase/server'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { Toaster } from '@/components/ui/toaster'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { PartnerMessagingInboxClient } from './partner-messaging-inbox-client'
import { MessagingInboxScrollLock } from './messaging-inbox-scroll-lock'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  const pm = t.partnerMessaging
  return buildMetadata({
    title: pm.pageTitle,
    description: pm.messagingInboxDescription,
    path: '/dashboard/messaging',
    noIndex: true,
  })
}

export default async function DashboardMessagingPage() {
  const { t } = getServerDictionary()
  const pm = t.partnerMessaging
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirectToLogin()

  const { data: rows } = await supabase
    .from('messaging_partners')
    .select('*')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <MessagingInboxScrollLock>
      <div className="app-shell flex h-[calc(100dvh-5rem)] max-md:h-[calc(100dvh-9rem)] min-h-0 flex-col overflow-hidden">
        <Toaster />
        <div className="flex min-h-0 flex-1 flex-col">
          <PartnerMessagingInboxClient initialPartners={rows ?? []} t={pm} />
        </div>
      </div>
    </MessagingInboxScrollLock>
  )
}
