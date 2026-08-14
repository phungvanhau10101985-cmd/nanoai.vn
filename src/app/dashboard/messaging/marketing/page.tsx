import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { isValidUuidString } from '@/lib/validate-uuid'
import { messagingSettingsSectionHref } from '@/lib/messaging/messaging-settings-section-href'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = getServerDictionary()
  const m = t.partnerMessagingMarketing
  return buildMetadata({
    title: m.pageTitle,
    description: m.pageDescription,
    path: '/dashboard/messaging/settings',
    noIndex: true,
  })
}

export default async function DashboardMessagingMarketingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  const sp = searchParams ? await searchParams : {}
  const raw = sp.partner
  const partner = Array.isArray(raw) ? raw[0] : raw
  redirect(messagingSettingsSectionHref('hub-marketing', partner))
}
