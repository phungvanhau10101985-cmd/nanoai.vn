import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { getServerDictionary, getCurrentWebLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { AccountPlanClientPage } from './account-plan-client'
import type { WebLocale } from '@/lib/i18n/config'

const OG_LOCALE: Record<WebLocale, string> = {
  vi: 'vi_VN',
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
}

export async function generateMetadata() {
  const locale = getCurrentWebLocale()
  const { t } = await getServerDictionary()
  const path = '/account/plan'
  return buildMetadata({
    title: t.accountPlan.pageTitle,
    description: t.accountPlan.metaDescription,
    path,
    keywords: ['NanoAI', 'plan', 'trial', 'subscription', 'credits', 'gói dịch vụ'],
    locale: OG_LOCALE[locale] ?? 'vi_VN',
    noIndex: true,
  })
}

export default async function AccountPlanPage() {
  const user = await getUserOrBypass()
  if (!user) {
    redirect('/auth/login?next=/account/plan')
  }

  const { t } = await getServerDictionary()
  const locale = getCurrentWebLocale()

  return <AccountPlanClientPage t={t.accountPlan} webLocale={locale} />
}
