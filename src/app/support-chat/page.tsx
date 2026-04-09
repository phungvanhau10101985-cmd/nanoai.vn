import type { Metadata } from 'next'
import { getUserOrBypass } from '@/lib/auth'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { WebLocale } from '@/lib/i18n/config'
import { Toaster } from '@/components/ui/toaster'
import { SupportChatClient } from '@/app/support-chat/support-chat-client'

const OG_LOCALE: Record<WebLocale, string> = {
  vi: 'vi_VN',
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = getCurrentWebLocale()
  const { t } = getServerDictionary()
  const path = '/support-chat'
  return buildMetadata({
    title: t.supportChat.pageTitle,
    description: t.supportChat.metaDescription,
    path,
    keywords: ['NanoAI', 'support', 'chat', 'customer care', 'Zalo', 'Facebook'],
    locale: OG_LOCALE[locale] ?? 'vi_VN',
    noIndex: false,
  })
}

export default async function SupportChatPage() {
  const user = await getUserOrBypass()
  const { t } = getServerDictionary()

  return (
    <>
      <Toaster />
      <div className="flex min-h-0 flex-1 flex-col">
        <SupportChatClient initialLoggedIn={!!user} t={t.supportChat} />
      </div>
    </>
  )
}
