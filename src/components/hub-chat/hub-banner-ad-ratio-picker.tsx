'use client'

import type { CSSProperties } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import {
  BANNER_AD_PRESETS,
  MAX_BANNER_BATCH_PRESETS,
  getBannerAdPresetById,
  getBannerAdPresetLabel,
  getGeminiBannerRatioFootnote,
  listGeminiRatioAdGuide,
  normalizeBannerAdPresetId,
  type BannerAdPresetId,
} from '@/lib/banner-ad-presets'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    batchHint: string
    maxHint: string
    aiBadge: string
    footnoteTitle: string
  }
> = {
  vi: {
    title: 'Tỷ lệ & kênh quảng cáo',
    hint: 'Chọn 1–4 tỷ lệ — mỗi tỷ lệ tạo một banner riêng khi bấm «Tạo banner».',
    batchHint: 'Đã chọn {n} tỷ lệ → tạo {n} banner một lúc.',
    maxHint: 'Tối đa {max} tỷ lệ mỗi lần tạo.',
    aiBadge: 'AI',
    footnoteTitle: 'Bảng tham khảo tỷ lệ AI',
  },
  en: {
    title: 'Ratio & ad channel',
    hint: 'Pick 1–4 ratios — each ratio creates a separate banner when you tap «Generate banner».',
    batchHint: '{n} ratio(s) selected → {n} banner(s) in one run.',
    maxHint: 'Up to {max} ratios per generation.',
    aiBadge: 'AI',
    footnoteTitle: 'AI ratio reference',
  },
  zh: {
    title: '比例与广告渠道',
    hint: '选择 1–4 个比例 — 每个比例点击「生成横幅」时各生成一个横幅。',
    batchHint: '已选 {n} 个比例 → 一次生成 {n} 个横幅。',
    maxHint: '每次最多 {max} 个比例。',
    aiBadge: 'AI',
    footnoteTitle: 'AI 比例参考',
  },
  ja: {
    title: '比率と広告チャネル',
    hint: '1〜4 比率を選択 — 各比率ごとに別バナーを生成します。',
    batchHint: '{n} 比率を選択 → 一度に {n} バナーを生成。',
    maxHint: '1回最大 {max} 比率。',
    aiBadge: 'AI',
    footnoteTitle: 'AI比率リファレンス',
  },
  ko: {
    title: '비율 및 광고 채널',
    hint: '1–4개 비율 선택 — 각 비율마다 «배너 생성» 시 별도 배너가 만들어집니다.',
    batchHint: '{n}개 비율 선택 → 한 번에 {n}개 배너 생성.',
    maxHint: '한 번에 최대 {max}개 비율.',
    aiBadge: 'AI',
    footnoteTitle: 'AI 비율 참고',
  },
}

function ratioPreviewStyle(ratio: string): CSSProperties {
  const normalized = ratio === '1.91:1' ? '16:9' : ratio
  const [wRaw, hRaw] = normalized.split(':').map(Number)
  const w = Number.isFinite(wRaw) && wRaw > 0 ? wRaw : 1
  const h = Number.isFinite(hRaw) && hRaw > 0 ? hRaw : 1
  const max = 28
  if (w >= h) {
    return { width: max, height: Math.max(12, Math.round((max * h) / w)) }
  }
  return { width: Math.max(12, Math.round((max * w) / h)), height: max }
}

export function HubBannerAdRatioPicker({
  locale,
  selectedPresetIds,
  busy,
  onTogglePreset,
  onMaxSelected,
  compact = false,
}: {
  locale: WebLocale
  selectedPresetIds: BannerAdPresetId[]
  busy: boolean
  onTogglePreset: (presetId: BannerAdPresetId) => void | Promise<void>
  onMaxSelected?: () => void
  compact?: boolean
}) {
  const t = COPY[locale]
  const footnote = getGeminiBannerRatioFootnote(locale)
  const ratioGuide = listGeminiRatioAdGuide(locale)
  const normalizedSelected = selectedPresetIds.map((id) => normalizeBannerAdPresetId(id))
  const count = normalizedSelected.length

  const handleToggle = (presetId: BannerAdPresetId) => {
    const id = normalizeBannerAdPresetId(presetId)
    const selected = normalizedSelected.includes(id)
    if (!selected && count >= MAX_BANNER_BATCH_PRESETS) {
      onMaxSelected?.()
      return
    }
    void onTogglePreset(id)
  }

  return (
    <div
      className={
        compact
          ? 'space-y-2'
          : 'rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20'
      }
    >
      {!compact ? (
        <>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{t.title}</p>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">{t.hint}</p>
        </>
      ) : null}

      {count > 0 ? (
        <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
          {t.batchHint.replace('{n}', String(count))}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t.maxHint.replace('{max}', String(MAX_BANNER_BATCH_PRESETS))}
        </p>
      )}

      <div className="mt-2 max-h-[320px] space-y-1.5 overflow-y-auto pr-0.5">
        {BANNER_AD_PRESETS.map((preset) => {
          const selected = normalizedSelected.includes(preset.id)
          return (
            <Button
              key={preset.id}
              type="button"
              variant={selected ? 'default' : 'outline'}
              disabled={busy}
              className={
                selected
                  ? 'h-auto min-h-11 w-full justify-start gap-2 whitespace-normal bg-amber-600 px-2.5 py-2 text-left text-xs hover:bg-amber-700'
                  : 'h-auto min-h-11 w-full justify-start gap-2 whitespace-normal px-2.5 py-2 text-left text-xs'
              }
              onClick={() => handleToggle(preset.id)}
            >
              <span
                aria-hidden
                className={`inline-block shrink-0 border ${selected ? 'border-amber-100 bg-amber-500/30' : 'border-amber-300 bg-amber-100/80 dark:border-amber-700 dark:bg-amber-900/40'}`}
                style={ratioPreviewStyle(preset.aspectRatio)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold">{preset.aspectRatio}</span>
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      selected
                        ? 'bg-amber-500/40 text-amber-50'
                        : 'bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100'
                    }`}
                  >
                    {t.aiBadge}
                  </span>
                </span>
                <span
                  className={`block font-medium leading-snug ${selected ? 'text-amber-50' : 'text-foreground'}`}
                >
                  {getBannerAdPresetLabel(getBannerAdPresetById(preset.id), locale)}
                </span>
              </span>
              {busy && selected ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
              {selected && !busy ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
            </Button>
          )
        })}
      </div>

      <details className="mt-3 rounded-md border border-amber-200/80 bg-white/60 dark:border-amber-800 dark:bg-amber-950/30">
        <summary className="cursor-pointer px-2.5 py-2 text-xs font-semibold text-amber-900 dark:text-amber-100">
          {t.footnoteTitle}
        </summary>
        <div className="space-y-1 border-t border-amber-200/80 px-2.5 py-2 dark:border-amber-800">
          <p className="text-[10px] leading-snug text-amber-800/90 dark:text-amber-200/90">{footnote.note}</p>
          <ul className="max-h-[160px] space-y-1 overflow-y-auto text-[10px] leading-snug text-muted-foreground">
            {ratioGuide.map(({ ratio, use }) => (
              <li key={ratio}>
                <span className="font-semibold text-amber-900 dark:text-amber-100">{ratio}</span>
                {' — '}
                {use}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  )
}
