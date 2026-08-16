'use client'

import { PackagingBoxMockup3D } from '@/components/hub-chat/packaging-box-mockup-3d'
import type { WebLocale } from '@/lib/i18n/config'
import { THIET_KE_BAO_BI_ARTICLE_MOCKUP } from './thiet-ke-bao-bi-article-mockup-data'

export function ThietKeBaoBiArticleMockup3D({
  locale,
  caption,
}: {
  locale: WebLocale
  caption: string
}) {
  return (
    <figure className="mt-5">
      <div className="flex justify-center">
        <PackagingBoxMockup3D
          dimensionsMm={THIET_KE_BAO_BI_ARTICLE_MOCKUP.dimensionsMm}
          faceSlots={THIET_KE_BAO_BI_ARTICLE_MOCKUP.faceSlots}
          locale={locale}
          showShareMenu={false}
        />
      </div>
      <figcaption className="mt-2 text-center text-xs leading-5 text-slate-500">{caption}</figcaption>
    </figure>
  )
}
