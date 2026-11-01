import type { Metadata } from 'next'
import { WeddingCard3dPreview } from '@/components/wedding/wedding-card-3d-preview'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { weddingCard3dCopy } from '@/lib/wedding/wedding-card-3d-copy'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const copy = weddingCard3dCopy(getCurrentWebLocale())
  return buildMetadata({
    title: copy.metaTitle,
    description: copy.metaDescription,
    path: '/thiep-3d',
    noIndex: true,
  })
}

export default function WeddingCard3dPage() {
  return <WeddingCard3dPreview locale={getCurrentWebLocale()} />
}
