'use client'

import { PackagingBagMockup3D } from '@/components/hub-chat/packaging-bag-mockup-3d'
import type { BagFaceSlot } from '@/lib/hub-chat/bag-kit-shared'
import type { WebLocale } from '@/lib/i18n/config'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'

const TITLE: Record<WebLocale, string> = {
  vi: 'Mockup 3D túi giấy',
  en: '3D paper bag mockup',
  zh: '3D 纸袋 mockup',
  ja: '3D 紙袋モックアップ',
  ko: '3D 종이봉투 목업',
}

type FaceSlots = Partial<
  Record<BagFaceSlot, { sourceMode: string; url?: string }>
>

export function PackagingBagMockupSharePublicClient({
  dimensionsMm,
  faceSlots,
  locale,
  sizeLabel,
}: {
  dimensionsMm: BagDimensionsMm
  faceSlots: FaceSlots
  locale: WebLocale
  sizeLabel: string
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-8 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-lg space-y-3 text-center">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{TITLE[locale]}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{sizeLabel}</p>
        <div className="flex justify-center">
          <PackagingBagMockup3D
            dimensionsMm={dimensionsMm}
            faceSlots={faceSlots}
            locale={locale}
            showShareMenu={false}
          />
        </div>
      </div>
    </main>
  )
}
