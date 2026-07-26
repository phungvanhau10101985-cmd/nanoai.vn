'use client'

import type { CSSProperties } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import {
  MENU_FORMAT_PRESETS,
  getMenuFormatPresetById,
  getMenuFormatPresetLabel,
  normalizeMenuFormatPresetId,
  type MenuFormatPresetId,
} from '@/lib/hub-chat/menu-format-presets'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    aiBadge: string
  }
> = {
  vi: {
    title: 'Kiểu & tỷ lệ menu',
    hint: 'Chọn một kiểu menu — AI sẽ thiết kế đúng tỷ lệ in hoặc màn hình.',
    aiBadge: 'AI',
  },
  en: {
    title: 'Menu format & ratio',
    hint: 'Pick one menu format — AI will design for print or display ratio.',
    aiBadge: 'AI',
  },
  zh: {
    title: '菜单版式与比例',
    hint: '选择一种菜单版式 — AI 将按印刷或屏幕比例设计。',
    aiBadge: 'AI',
  },
  ja: {
    title: 'メニュー形式・比率',
    hint: 'メニュー形式を1つ選択 — 印刷または表示比率に合わせてデザインします。',
    aiBadge: 'AI',
  },
  ko: {
    title: '메뉴 형식·비율',
    hint: '메뉴 형식 1개 선택 — 인쇄 또는 화면 비율에 맞게 디자인합니다.',
    aiBadge: 'AI',
  },
}

function ratioPreviewStyle(ratio: string): CSSProperties {
  const [wRaw, hRaw] = ratio.split(':').map(Number)
  const w = Number.isFinite(wRaw) && wRaw > 0 ? wRaw : 1
  const h = Number.isFinite(hRaw) && hRaw > 0 ? hRaw : 1
  const max = 28
  if (w >= h) {
    return { width: max, height: Math.max(12, Math.round((max * h) / w)) }
  }
  return { width: Math.max(12, Math.round((max * w) / h)), height: max }
}

export function HubMenuFormatPicker({
  locale,
  selectedPresetId,
  busy,
  onSelectPreset,
}: {
  locale: WebLocale
  selectedPresetId: MenuFormatPresetId | ''
  busy: boolean
  onSelectPreset: (presetId: MenuFormatPresetId) => void | Promise<void>
}) {
  const t = COPY[locale]

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">{t.title}</p>
        <p className="mt-0.5 text-[11px] text-amber-800/70 dark:text-amber-200/70">{t.hint}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MENU_FORMAT_PRESETS.map((preset) => {
          const id = preset.id
          const selected = selectedPresetId === id
          const label = getMenuFormatPresetLabel(preset, locale)
          const adPreset = getMenuFormatPresetById(id)
          return (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              disabled={busy}
              className={
                selected
                  ? 'h-auto min-h-9 gap-1.5 border-amber-600 bg-amber-700 px-2 py-1.5 text-left text-[11px] hover:bg-amber-800'
                  : 'h-auto min-h-9 gap-1.5 border-amber-200 bg-white/80 px-2 py-1.5 text-left text-[11px] text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-900/40'
              }
              onClick={() => void onSelectPreset(id)}
            >
              <span
                className="inline-block shrink-0 rounded-sm border border-current/30 bg-current/10"
                style={ratioPreviewStyle(adPreset.aspectRatio)}
                aria-hidden
              />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-medium">{label}</span>
                <span className="block text-[10px] opacity-75">
                  {adPreset.aspectRatio} · {t.aiBadge}
                </span>
              </span>
              {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              {busy && selected ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export { normalizeMenuFormatPresetId, type MenuFormatPresetId }
