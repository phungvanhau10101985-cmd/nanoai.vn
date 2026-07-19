'use client'

import { Check, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    confirm: string
    reenter: string
  }
> = {
  vi: {
    title: 'Xác nhận kích thước mặt hộp',
    hint: 'Kiểm tra tóm tắt kích thước ở trên. Nếu đúng bấm Xác nhận; nếu sai bấm Nhập lại.',
    confirm: 'Xác nhận OK',
    reenter: 'Nhập lại kích thước',
  },
  en: {
    title: 'Confirm box face dimensions',
    hint: 'Review the size summary above. Confirm if correct, or re-enter dimensions.',
    confirm: 'Confirm OK',
    reenter: 'Re-enter dimensions',
  },
  zh: {
    title: '确认盒面尺寸',
    hint: '请查看上方的尺寸摘要。正确则确认，否则重新输入尺寸。',
    confirm: '确认 OK',
    reenter: '重新输入尺寸',
  },
  ja: {
    title: '箱面サイズの確認',
    hint: '上のサイズ概要を確認してください。正しければ確定、違う場合は再入力。',
    confirm: 'OK で確定',
    reenter: 'サイズを再入力',
  },
  ko: {
    title: '상자 면 크기 확인',
    hint: '위 요약을 확인하세요. 맞으면 확인, 다르면 크기를 다시 입력하세요.',
    confirm: 'OK 확인',
    reenter: '크기 다시 입력',
  },
}

export function HubBoxFaceConfirmActions({
  locale,
  busy,
  onConfirm,
  onReenter,
}: {
  locale: WebLocale
  busy: boolean
  onConfirm: () => void | Promise<void>
  onReenter: () => void
}) {
  const t = COPY[locale]

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          disabled={busy}
          onClick={() => void onConfirm()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t.confirm}
        </Button>
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
