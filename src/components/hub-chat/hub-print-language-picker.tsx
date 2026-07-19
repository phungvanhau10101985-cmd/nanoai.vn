'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import {
  PACKAGING_PRINT_LANGUAGE_CHOICES,
  packagingPrintLanguageLabel,
  type PackagingPrintLanguageKey,
} from '@/lib/packaging/packaging-print-language'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    otherLabel: string
    otherPlaceholder: string
  }
> = {
  vi: {
    title: 'Ngôn ngữ in trên bao bì',
    hint: 'Chọn ngôn ngữ mặc định cho chữ in — vẫn nhập loại sản phẩm ở ô chat bên dưới.',
    otherLabel: 'Ngôn ngữ khác',
    otherPlaceholder: 'VD: tiếng Pháp, tiếng Thái, tiếng Hàn…',
  },
  en: {
    title: 'Print language on packaging',
    hint: 'Pick the default language for printed copy — still enter product type in the chat box below.',
    otherLabel: 'Other language',
    otherPlaceholder: 'e.g. French, Thai, Korean…',
  },
  zh: {
    title: '包装印刷语言',
    hint: '选择印刷文案的默认语言 — 产品类型仍在下方聊天框输入。',
    otherLabel: '其他语言',
    otherPlaceholder: '例如：法语、泰语、韩语…',
  },
  ja: {
    title: '包装の印刷言語',
    hint: '印刷コピーのデフォルト言語を選択 — 製品タイプは下のチャット欄に入力。',
    otherLabel: 'その他の言語',
    otherPlaceholder: '例：フランス語、タイ語、韓国語…',
  },
  ko: {
    title: '포장 인쇄 언어',
    hint: '인쇄 문구 기본 언어를 선택 — 제품 유형은 아래 채팅창에 입력하세요.',
    otherLabel: '기타 언어',
    otherPlaceholder: '예: 프랑스어, 태국어, 한국어…',
  },
}

export function HubPrintLanguagePicker({
  locale,
  selectedKey,
  otherDetail = '',
  busy,
  onSelect,
}: {
  locale: WebLocale
  selectedKey: PackagingPrintLanguageKey
  otherDetail?: string
  busy: boolean
  onSelect: (key: PackagingPrintLanguageKey, otherDetail?: string) => void | Promise<void>
}) {
  const t = COPY[locale]
  const [otherText, setOtherText] = useState(otherDetail)

  useEffect(() => {
    setOtherText(otherDetail)
  }, [otherDetail])

  const commitOtherDetail = (value: string) => {
    if (selectedKey !== 'other') return
    void onSelect('other', value.trim())
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {PACKAGING_PRINT_LANGUAGE_CHOICES.map((choice) => {
          const selected = choice.key === selectedKey
          return (
            <Button
              key={choice.key}
              type="button"
              variant={selected ? 'default' : 'outline'}
              disabled={busy}
              className={
                selected
                  ? 'h-auto min-h-10 whitespace-normal bg-violet-600 px-3 py-2 text-left text-xs leading-snug hover:bg-violet-700'
                  : 'h-auto min-h-10 whitespace-normal px-3 py-2 text-left text-xs leading-snug'
              }
              onClick={() =>
                void onSelect(
                  choice.key,
                  choice.key === 'other' ? otherText.trim() || undefined : undefined
                )
              }
            >
              {busy && selected ? <Loader2 className="mr-2 h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
              {formatStudioExampleLabel(locale, packagingPrintLanguageLabel(choice, locale))}
            </Button>
          )
        })}
      </div>
      {selectedKey === 'other' ? (
        <div className="mt-3 space-y-1.5">
          <label className="text-xs font-medium text-violet-900 dark:text-violet-100">{t.otherLabel}</label>
          <Input
            value={otherText}
            disabled={busy}
            placeholder={t.otherPlaceholder}
            className="h-9 bg-background text-xs"
            onChange={(e) => setOtherText(e.target.value)}
            onBlur={() => commitOtherDetail(otherText)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitOtherDetail(otherText)
              }
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
