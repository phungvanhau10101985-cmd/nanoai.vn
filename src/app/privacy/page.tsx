import type { Metadata } from 'next'
import { LegalPageDocument } from '@/components/legal/legal-documents'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  const path = '/privacy'
  return buildMetadata({
    title: t.legal.privacy.pageTitle,
    description: t.legal.privacy.metaDescription,
    path,
    keywords: [
      'privacy',
      'NanoAI',
      'chính sách quyền riêng tư',
      'privacy policy',
      '個人情報',
      '隐私',
    ],
  })
}

export default function PrivacyPage() {
  const { t } = getServerDictionary()
  return (
    <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t.legal.privacy.pageTitle}</h1>
        <p className="text-muted-foreground">{t.legal.privacy.metaDescription}</p>
      </header>
      <div className="prose prose-neutral dark:prose-invert max-w-none pt-6">
        <LegalPageDocument doc={t.legal.privacy} />
      </div>
    </div>
  )
}
