import type { Metadata } from 'next'
import { LegalPageDocument } from '@/components/legal/legal-documents'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  const path = '/terms'
  return buildMetadata({
    title: t.legal.terms.pageTitle,
    description: t.legal.terms.metaDescription,
    path,
    keywords: ['terms', 'NanoAI', 'điều khoản', '利用規約', '服务条款', '이용약관'],
  })
}

export default function TermsPage() {
  const { t } = getServerDictionary()
  return (
    <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t.legal.terms.pageTitle}</h1>
        <p className="text-muted-foreground">{t.legal.terms.metaDescription}</p>
      </header>
      <div className="prose prose-neutral dark:prose-invert max-w-none pt-6">
        <LegalPageDocument doc={t.legal.terms} />
      </div>
    </div>
  )
}
