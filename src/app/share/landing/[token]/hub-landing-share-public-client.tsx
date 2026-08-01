'use client'

import type { WebLocale } from '@/lib/i18n/config'
import type { LandingPageSection } from '@/lib/hub-chat/landing-page-sections'
import { HubLandingComposedPreview } from '@/components/hub-chat/hub-landing-composed-preview'

export function HubLandingSharePublicClient({
  title,
  logoUrl,
  sections,
  locale,
}: {
  title: string
  logoUrl?: string | null
  sections: LandingPageSection[]
  locale: WebLocale
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <HubLandingComposedPreview
          locale={locale}
          title={title}
          logoUrl={logoUrl}
          sections={sections}
        />
      </div>
    </main>
  )
}
