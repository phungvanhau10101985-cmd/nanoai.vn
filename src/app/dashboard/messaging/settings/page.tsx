import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { Settings } from 'lucide-react'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { PartnerMessagingSettingsClient } from '../partner-messaging-settings-client'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  const pm = t.partnerMessaging
  return buildMetadata({
    title: pm.messagingSettingsPageTitle,
    description: pm.pageDescription,
    path: '/dashboard/messaging/settings',
    noIndex: true,
  })
}

export default async function DashboardMessagingSettingsPage() {
  const { locale, t } = getServerDictionary()
  const pm = t.partnerMessaging
  const pmAi = t.partnerMessagingAi
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirectToLogin()

  const { data: rows } = await supabase
    .from('messaging_partners')
    .select('*')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false })

  const partnerAiLlmModel = 'deepseek-chat'

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-6 md:space-y-8">
      <Toaster />
      <div className="section-surface space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <Settings className="h-7 w-7 shrink-0 text-violet-600" aria-hidden />
              {pm.messagingSettingsPageTitle}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{pm.pageDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/messaging">{pm.goToInbox}</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">{t.menu.dashboard}</Link>
            </Button>
          </div>
        </div>
      </div>
      <PartnerMessagingSettingsClient
        initialPartners={rows ?? []}
        locale={locale}
        t={pm}
        tAi={pmAi}
        partnerAiLlmModel={partnerAiLlmModel}
      />
    </div>
  )
}
