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
  }
> = {
  vi: {
    custom: 'Khác — nhập tay',
    customHint: 'Hoặc gõ nội dung tùy chỉnh vào ô chat bên dưới.',
  },
  en: {
    custom: 'Other — type custom',
    customHint: 'Or type a custom answer in the chat box below.',
  },
  zh: {
    custom: '其他 — 手动输入',
    customHint: '或在下方聊天框输入自定义内容。',
  },
  ja: {
    custom: 'その他 — 手入力',
    customHint: 'または下のチャット欄に自由入力してください。',
  },
  ko: {
    custom: '기타 — 직접 입력',
    customHint: '또는 아래 채팅창에 직접 입력하세요.',
  },
}

export function HubDiscoveryChoicePicker({
  locale,
  title,
  hint,
  choices,
  busy,
  showCustomOption,
  onSelect,
  onCustom,
}: {
  locale: WebLocale
  title: string
  hint: string
  choices: PackagingDiscoveryChoice[]
  busy: boolean
  showCustomOption?: boolean
  onSelect: (choiceKey: string) => void | Promise<void>
  onCustom?: () => void
}) {
  const t = COPY[locale]

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => (
          <Button
            key={choice.key}
            type="button"
            variant="outline"
            disabled={busy}
            className="h-auto min-h-10 whitespace-normal px-3 py-2 text-left text-xs leading-snug"
            onClick={() => void onSelect(choice.key)}
          >
            {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
            {formatStudioExampleLabel(locale, packagingDiscoveryChoiceLabel(choice, locale))}
          </Button>
        ))}
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
