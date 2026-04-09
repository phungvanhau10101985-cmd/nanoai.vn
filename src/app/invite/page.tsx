import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { getServerDictionary, getCurrentWebLocale } from '@/lib/i18n/server'
import { buildMetadata, SITE_URL } from '@/lib/seo'
import { InviteClientPage } from './invite-client'
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
  const path = '/invite'
  return buildMetadata({
    title: t.referral.pageTitle,
    description: t.referral.metaDescription,
    path,
    keywords: ['NanoAI', 'invite', 'referral', 'credits', 'giới thiệu'],
    locale: OG_LOCALE[locale] ?? 'vi_VN',
    noIndex: true,
  })
}

export default async function InvitePage() {
  const user = await getUserOrBypass()
  if (!user) {
    redirect('/auth/login?next=/invite')
  }

  const { t } = await getServerDictionary()
  const base = SITE_URL.replace(/\/$/, '')
  const inviteUrl = `${base}/?ref=${encodeURIComponent(user.id)}`

  return <InviteClientPage inviteUrl={inviteUrl} t={t.referral} />
}
