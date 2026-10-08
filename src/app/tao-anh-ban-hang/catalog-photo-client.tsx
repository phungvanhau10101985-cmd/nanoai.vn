'use client'

import { ProductStudioAiPanel } from '@/components/partner-website/product-studio/product-studio-ai-panel'
import type { ProductStudioExportUi } from '@/lib/catalog-photo/catalog-photo-copy'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function CatalogPhotoClient({
  title,
  t,
  exportUi,
}: {
  title: string
  t: Dictionary['partnerMessagingAi']
  exportUi: ProductStudioExportUi
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{exportUi.intro}</p>
      </div>
      <ProductStudioAiPanel
        variant="export"
        apiBase="/api/catalog-photos"
        t={t}
        exportUi={exportUi}
        onPublished={() => {}}
      />
    </div>
  )
}
