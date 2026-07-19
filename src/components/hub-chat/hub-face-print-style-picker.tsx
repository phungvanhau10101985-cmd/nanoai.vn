'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import {
  FACE_PRINT_STYLE_KEYS,
  facePrintStyleLabel,
  type FacePrintStyleKey,
} from '@/lib/packaging/face-print-style'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    confirm: string
  }
> = {
  vi: {
    title: 'Phong cách hình ảnh cho 6 mặt hộp',
    hint: 'Chọn một phong cách hình ảnh — hệ thống sẽ áp dụng đồng bộ cho tất cả các mặt.',
    confirm: 'Chọn một kiểu để tiếp tục',
  },
  en: {
    title: 'Visual art style for all 6 faces',
    hint: 'Choose one visual style — it will be applied consistently to every box face.',
    confirm: 'Choose one style to continue',
  },
  zh: {
    title: '六个盒面的图像风格',
    hint: '选择一种图像风格，系统将统一应用于所有盒面。',
    confirm: '选择一种风格以继续',
  },
  ja: {
    title: '箱6面のビジュアルスタイル',
    hint: '1つ選択すると、すべての面に同じ表現を適用します。',
    confirm: 'スタイルを選択して続行',
  },
  ko: {
    title: '상자 6면 이미지 스타일',
    hint: '하나를 선택하면 모든 면에 같은 표현 방식이 적용됩니다.',
    confirm: '스타일을 선택해 계속',
  },
}

export function HubFacePrintStylePicker({
  locale,
  busy,
  onSelect,
}: {
  locale: WebLocale
  busy: boolean
  onSelect: (styleKey: FacePrintStyleKey) => void | Promise<void>
}) {
  const t = COPY[locale]

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {FACE_PRINT_STYLE_KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            disabled={busy}
            className="h-auto min-h-10 whitespace-normal px-3 py-2 text-left text-xs leading-snug"
            onClick={() => void onSelect(key)}
          >
            {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
            {formatStudioExampleLabel(locale, facePrintStyleLabel(key, locale))}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t.confirm}</p>
    </div>
  )
}
