import type { Metadata } from 'next'
import { DataDeletionDocument } from '@/components/legal/legal-documents'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  const path = '/data-deletion'
  return buildMetadata({
    title: t.legal.dataDeletion.pageTitle,
    description: t.legal.dataDeletion.metaDescription,
    path,
    keywords: [
      'data deletion',
      'GDPR',
      'NanoAI',
      'Facebook',
      'privacy',
      'ユーザー削除',
      '数据删除',
    ],
  })
}

export default function DataDeletionPage() {
  const { t } = getServerDictionary()
  return (
    <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t.legal.dataDeletion.pageTitle}</h1>
        <p className="text-muted-foreground">{t.legal.dataDeletion.metaDescription}</p>
      </header>
      <div className="prose prose-neutral dark:prose-invert max-w-none pt-6">
        <DataDeletionDocument doc={t.legal.dataDeletion} />
      </div>
    </div>
  )
}
