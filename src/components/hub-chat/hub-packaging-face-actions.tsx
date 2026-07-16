'use client'

import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import {
  BOX_FACE_COPY_SOURCE,
  getBoxFaceSlotLabel,
  isSecondaryBoxFaceSlot,
  type BoxFaceSlot,
} from '@/lib/packaging/box-face-slots'

const COPY: Record<
  WebLocale,
  {
    hint: string
    blank: string
    sameAs: (label: string) => string
    blankMessage: string
    copyMessage: (label: string) => string
  }
> = {
  vi: {
    hint: 'Không cần in mặt này? Chọn nhanh — không tốn credits.',
    blank: 'Bỏ trống',
    sameAs: (label) => `Giống ${label}`,
    blankMessage: 'bỏ trống',
    copyMessage: (label) => `giống ${label.toLowerCase()}`,
  },
  en: {
    hint: 'No print on this face? Quick action — no credits used.',
    blank: 'Leave blank',
    sameAs: (label) => `Same as ${label}`,
    blankMessage: 'leave blank',
    copyMessage: (label) => `same as ${label.toLowerCase()}`,
  },
  zh: {
    hint: '此面不印刷？快捷选择 — 不消耗积分。',
    blank: '留空',
    sameAs: (label) => `同${label}`,
    blankMessage: '留空',
    copyMessage: (label) => `同${label}`,
  },
  ja: {
    hint: 'この面は印刷しない？クイック選択 — クレジット不要。',
    blank: '空白',
    sameAs: (label) => `${label}と同じ`,
    blankMessage: '空白',
    copyMessage: (label) => `${label}と同じ`,
  },
  ko: {
    hint: '이 면은 인쇄 안 함? 빠른 선택 — 크레딧 없음.',
    blank: '비우기',
    sameAs: (label) => `${label}와 동일`,
    blankMessage: '비우기',
    copyMessage: (label) => `${label}와 동일`,
  },
}

export function HubPackagingFaceActions({
  locale,
  slot,
  busy,
  onSubmit,
}: {
  locale: WebLocale
  slot: BoxFaceSlot
  busy: boolean
  onSubmit: (message: string) => void | Promise<void>
}) {
  const t = COPY[locale]
  const copyFrom = BOX_FACE_COPY_SOURCE[slot]
  const copySourceLabel = copyFrom ? getBoxFaceSlotLabel(copyFrom, locale) : null

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-xs text-muted-foreground">{t.hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => void onSubmit(t.blankMessage)}
        >
          {t.blank}
        </Button>
        {isSecondaryBoxFaceSlot(slot) && copySourceLabel ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy}
            onClick={() => void onSubmit(t.copyMessage(copySourceLabel))}
          >
            {t.sameAs(copySourceLabel)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
