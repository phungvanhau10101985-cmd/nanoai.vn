'use client'

import { Check, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    chooseHint: string
    confirm: string
    reenter: string
  }
> = {
  vi: {
    title: 'Xác nhận kích thước mặt hộp',
    hint: 'Kiểm tra tóm tắt kích thước ở trên. Nếu đúng bấm Xác nhận; nếu sai bấm Nhập lại.',
    chooseHint: 'Tỷ lệ gần chuẩn phải chọn một cỡ đúng tỷ lệ. Tỷ lệ lệch xa giữ nguyên và dùng NanoAI F1.5K / F2K / F4K.',
    confirm: 'Xác nhận OK',
    reenter: 'Nhập lại kích thước',
  },
  en: {
    title: 'Confirm box face dimensions',
    hint: 'Review the size summary above. Confirm if correct, or re-enter dimensions.',
    chooseHint: 'A close ratio must be set to an exact standard size. A distant ratio stays as entered and uses NanoAI F1.5K / F2K / F4K.',
    confirm: 'Confirm OK',
    reenter: 'Re-enter dimensions',
  },
  zh: {
    title: '确认盒面尺寸',
    hint: '请查看上方的尺寸摘要。正确则确认，否则重新输入尺寸。',
    chooseHint: '接近标准的比例必须改成精确比例。差太远的比例保持原尺寸，并使用 NanoAI F1.5K / F2K / F4K。',
    confirm: '确认 OK',
    reenter: '重新输入尺寸',
  },
  ja: {
    title: '箱面サイズの確認',
    hint: '上のサイズ概要を確認してください。正しければ確定、違う場合は再入力。',
    chooseHint: '近い比率は正確な比率の寸法を選んでください。遠い比率は入力のまま NanoAI F1.5K / F2K / F4K を使います。',
    confirm: 'OK で確定',
    reenter: 'サイズを再入力',
  },
  ko: {
    title: '상자 면 크기 확인',
    hint: '위 요약을 확인하세요. 맞으면 확인, 다르면 크기를 다시 입력하세요.',
    chooseHint: '가까운 비율은 정확한 표준 크기를 고르세요. 먼 비율은 입력값 그대로 NanoAI F1.5K / F2K / F4K를 씁니다.',
    confirm: 'OK 확인',
    reenter: '크기 다시 입력',
  },
}

export function HubBoxFaceConfirmActions({
  locale,
  busy,
  options = [],
  onConfirm,
  onReenter,
}: {
  locale: WebLocale
  busy: boolean
  options?: Array<{ direction: 'larger' | 'smaller'; label: string }>
  onConfirm: (direction?: 'larger' | 'smaller') => void | Promise<void>
  onReenter: () => void
}) {
  const t = COPY[locale]
  const choosing = options.length > 0

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{choosing ? t.chooseHint : t.hint}</p>
      <div className="mt-3 flex flex-col gap-2">
        {choosing ? (
          options.map((option) => (
            <Button
              key={option.direction}
              type="button"
              className="h-auto justify-start gap-2 whitespace-normal bg-indigo-600 py-2 text-left hover:bg-indigo-700"
              disabled={busy}
              onClick={() => void onConfirm(option.direction)}
            >
              {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Check className="h-4 w-4 shrink-0" />}
              {option.label}
            </Button>
          ))
        ) : (
          <Button
            type="button"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t.confirm}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={onReenter}
        >
          <RotateCcw className="h-4 w-4" />
          {t.reenter}
        </Button>
      </div>
    </div>
  )
}
