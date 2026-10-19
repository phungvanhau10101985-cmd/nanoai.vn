import type { Metadata } from 'next'
import { LegalPageDocument } from '@/components/legal/legal-documents'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.legal.payment.pageTitle,
    description: t.legal.payment.metaDescription,
    path: '/chinh-sach-thanh-toan',
    keywords: ['chính sách thanh toán', 'payment policy', 'NanoAI', '付款', '결제'],
  })
}

export default function PaymentPolicyPage() {
  const { t } = getServerDictionary()
  return (
    <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t.legal.payment.pageTitle}</h1>
        <p className="text-muted-foreground">{t.legal.payment.metaDescription}</p>
      </header>
      <div className="prose prose-neutral dark:prose-invert max-w-none pt-6">
        <LegalPageDocument doc={t.legal.payment} />
      </div>
    </div>
  )
}
