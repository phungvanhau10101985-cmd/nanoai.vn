'use client'

import { Loader2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import {
  packagingDiscoveryChoiceLabel,
  type PackagingDiscoveryChoice,
} from '@/lib/packaging/packaging-discovery-choices'

const COPY: Record<
  WebLocale,
  {
    custom: string
    customHint: string
    processing: string
  }
> = {
  vi: {
    custom: 'Khác — nhập tay',
    customHint: 'Hoặc gõ nội dung tùy chỉnh vào ô chat bên dưới.',
    processing: 'Đang xử lý lựa chọn…',
  },
  en: {
    custom: 'Other — type custom',
    customHint: 'Or type a custom answer in the chat box below.',
    processing: 'Processing your choice…',
  },
  zh: {
    custom: '其他 — 手动输入',
    customHint: '或在下方聊天框输入自定义内容。',
    processing: '正在处理所选选项…',
  },
  ja: {
    custom: 'その他 — 手入力',
    customHint: 'または下のチャット欄に自由入力してください。',
    processing: '選択を処理中…',
  },
  ko: {
    custom: '기타 — 직접 입력',
    customHint: '또는 아래 채팅창에 직접 입력하세요.',
    processing: '선택한 항목을 처리 중…',
  },
}

export function HubDiscoveryChoicePicker({
  locale,
  title,
  hint,
  choices,
  busy,
  selectedKey = null,
  exampleLabels = true,
  showCustomOption,
  onSelect,
  onCustom,
}: {
  locale: WebLocale
  title: string
  hint: string
  choices: PackagingDiscoveryChoice[]
  busy: boolean
  /** Only this choice shows a spinner while busy (avoids every button spinning). */
  selectedKey?: string | null
  /** Discovery suggestion chips use "Example:" prefix; layout pickers should not. */
  exampleLabels?: boolean
  showCustomOption?: boolean
  onSelect: (choiceKey: string) => void | Promise<void>
  onCustom?: () => void
}) {
  const t = COPY[locale]

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {busy && selectedKey ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-300">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          {t.processing}
        </p>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          const label = packagingDiscoveryChoiceLabel(choice, locale)
          const display = exampleLabels ? formatStudioExampleLabel(locale, label) : label
          const isSelectedBusy = busy && selectedKey === choice.key
          return (
            <Button
              key={choice.key}
              type="button"
              variant={selectedKey === choice.key ? 'default' : 'outline'}
              disabled={busy}
              className={
                selectedKey === choice.key
                  ? 'h-auto min-h-10 whitespace-normal bg-violet-600 px-3 py-2 text-left text-xs leading-snug hover:bg-violet-700'
                  : 'h-auto min-h-10 whitespace-normal px-3 py-2 text-left text-xs leading-snug'
              }
              onClick={() => void onSelect(choice.key)}
            >
              {isSelectedBusy ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : null}
              {display}
            </Button>
          )
        })}
        {showCustomOption && onCustom ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            className="h-auto min-h-10 whitespace-normal px-3 py-2 text-left text-xs leading-snug sm:col-span-2"
            onClick={onCustom}
          >
            <PenLine className="mr-2 h-3.5 w-3.5 shrink-0" />
            {t.custom}
          </Button>
        ) : null}
      </div>
      {showCustomOption && onCustom ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{t.customHint}</p>
      ) : null}
    </div>
  )
}
