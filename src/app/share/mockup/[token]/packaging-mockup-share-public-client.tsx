'use client'

import { PackagingBoxMockup3D } from '@/components/hub-chat/packaging-box-mockup-3d'
import type { WebLocale } from '@/lib/i18n/config'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { BoxFaceSlot, FaceSourceMode } from '@/lib/packaging/box-face-slots'

const TITLE: Record<WebLocale, string> = {
  vi: 'Mockup 3D hộp bao bì',
  en: '3D packaging box mockup',
  zh: '3D 包装盒 mockup',
  ja: '3D 箱モックアップ',
  ko: '3D 포장 상자 목업',
}

type FaceSlots = Partial<Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url?: string }>>

export function PackagingMockupSharePublicClient({
  dimensionsMm,
  faceSlots,
  locale,
  sizeLabel,
}: {
  dimensionsMm: BoxDimensionsMm
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
          <PackagingBoxMockup3D
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
