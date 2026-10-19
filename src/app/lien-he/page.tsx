import type { Metadata } from 'next'
import { LegalPageDocument } from '@/components/legal/legal-documents'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'

const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'OnlineStore',
  name: 'NanoAI',
  url: 'https://nanoai.vn',
  email: 'support@nanoai.vn',
  areaServed: 'VN',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: 'support@nanoai.vn',
    areaServed: 'VN',
    availableLanguage: ['Vietnamese', 'English'],
    hoursAvailable: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '08:30',
      closes: '17:30',
    },
  },
}

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.legal.contact.pageTitle,
    description: t.legal.contact.metaDescription,
    path: '/lien-he',
    keywords: ['liên hệ', 'contact', 'NanoAI', 'support@nanoai.vn'],
  })
}

export default function ContactPage() {
  const { t } = getServerDictionary()
  return (
    <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t.legal.contact.pageTitle}</h1>
        <p className="text-muted-foreground">{t.legal.contact.metaDescription}</p>
      </header>
      <div className="prose prose-neutral dark:prose-invert max-w-none pt-6">
        <LegalPageDocument doc={t.legal.contact} />
      </div>
    </div>
  )
}
