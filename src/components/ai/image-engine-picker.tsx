'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { GPT_IMAGE_CREDITS, type GptImageQuality, type ImageEngine } from '@/lib/ai/image-engine'
import { publicGeminiImageName, publicGptImageName } from '@/lib/ai/nanoai-image-names'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function formatCredit(value: number, locale: WebLocale): string {
  return value.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })
}

function QualityChoice({
  active,
  label,
  purpose,
  onClick,
}: {
  active: boolean
  label: string
  purpose?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'w-full rounded-md px-2 py-1.5 text-left transition-colors',
        active ? 'bg-violet-600 text-white' : 'bg-muted/60 text-foreground hover:bg-white'
      )}
    >
      <span className="block text-xs font-medium">{label}</span>
      {purpose ? (
        <span className={cn('mt-0.5 block text-[10px] leading-snug', active ? 'text-violet-100' : 'text-muted-foreground')}>{purpose}</span>
      ) : null}
    </button>
  )
}

type PickerTier =
  | { key: string; engine: 'gpt'; quality: GptImageQuality; name: string; credit: number; purpose?: string }
  | { key: string; engine: 'gemini'; quality: '2K' | '4K'; name: string; credit: number; purpose?: string }

export function ImageEnginePicker({
  locale,
  engine,
  onEngineChange,
  geminiQuality,
  onGeminiQualityChange,
  gptQuality,
  onGptQualityChange,
  gptQualities = ['low', 'medium', 'high'],
  geminiCost2k = 1,
  geminiCost4k,
  engines = ['gemini', 'gpt'],
  qualityPurpose,
}: {
  locale: string
  engine: ImageEngine
  onEngineChange: (engine: ImageEngine) => void
  geminiQuality?: '2K' | '4K'
  onGeminiQualityChange?: (quality: '2K' | '4K') => void
  gptQuality: GptImageQuality
  onGptQualityChange: (quality: GptImageQuality) => void
  /** Mức GPT hiện trong hộp. Mặc định đủ low, medium, high. */
  gptQualities?: readonly GptImageQuality[]
  geminiCost2k?: number
  /** `null` hoặc bỏ trống: tool khóa 2K, không hiện nút 4K. */
  geminiCost4k?: number | null
  /** Engine được chọn. Một phần tử thì chỉ hiện mức của engine đó. */
  engines?: readonly ImageEngine[]
  /** Một dòng mục đích dưới từng mức. */
  qualityPurpose?: Partial<Record<GptImageQuality | 'gemini2k' | 'gemini4k', string>>
}) {
  const webLocale: WebLocale = locale === 'en' || locale === 'zh' || locale === 'ja' || locale === 'ko' ? locale : 'vi'
  const t = getDictionary(webLocale).imageGenerationClient
  const allowGemini = engines.includes('gemini')
  const allowGpt = engines.includes('gpt')
  const shownGeminiQuality = geminiCost4k == null ? '2K' : (geminiQuality ?? '2K')
  const [open, setOpen] = useState(false)
  const tiers: PickerTier[] = []
  if (allowGpt) {
    for (const quality of gptQualities) {
      tiers.push({
        key: `gpt-${quality}`,
        engine: 'gpt',
        quality,
        name: publicGptImageName(quality),
        credit: GPT_IMAGE_CREDITS[quality],
        purpose: qualityPurpose?.[quality],
      })
    }
  }
  if (allowGemini) {
    tiers.push({
      key: 'gemini-2k',
      engine: 'gemini',
      quality: '2K',
      name: publicGeminiImageName('2K'),
      credit: geminiCost2k,
      purpose: qualityPurpose?.gemini2k,
    })
    if (geminiCost4k != null) {
      tiers.push({
        key: 'gemini-4k',
        engine: 'gemini',
        quality: '4K',
        name: publicGeminiImageName('4K'),
        credit: geminiCost4k,
        purpose: qualityPurpose?.gemini4k,
      })
    }
  }
  const selected = tiers.find((tier) =>
    tier.engine === 'gpt'
      ? engine === 'gpt' && gptQuality === tier.quality
      : engine === 'gemini' && shownGeminiQuality === tier.quality,
  )
  const selectedName = selected?.name
    ?? (engine === 'gpt' ? publicGptImageName(gptQuality) : publicGeminiImageName(shownGeminiQuality))
  const selectedCredit = selected?.credit
    ?? (engine === 'gpt'
      ? GPT_IMAGE_CREDITS[gptQuality]
      : shownGeminiQuality === '4K' && geminiCost4k != null
        ? geminiCost4k
        : geminiCost2k)
  const triggerLabel = `${selectedName} (${formatCredit(selectedCredit, webLocale)})`
  const hasPurpose = tiers.some((tier) => Boolean(tier.purpose))

  function chooseTier(tier: PickerTier) {
    if (tier.engine === 'gemini') {
      if (!allowGemini) return
      if (engine !== 'gemini') onEngineChange('gemini')
      onGeminiQualityChange?.(tier.quality)
    } else {
      if (!allowGpt) return
      if (engine !== 'gpt') onEngineChange('gpt')
      onGptQualityChange(tier.quality)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 max-w-full shrink-0 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2.5 text-xs font-medium text-violet-900 hover:bg-violet-100"
          aria-label={`${t.imageEngineLabel}: ${triggerLabel}`}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      {/* Picker nằm trong dialog z-[200], sheet z-[550], Hub Studio toàn màn z max: menu phải nổi trên mọi lớp. */}
      <PopoverContent
        align="end"
        side="top"
        collisionPadding={12}
        className={cn('z-[2147483647] p-3', hasPurpose ? 'w-[22rem]' : 'w-[16rem]')}
      >
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t.imageEngineLabel}</p>
          <div className="space-y-1">
            {tiers.map((tier) => (
              <QualityChoice
                key={tier.key}
                active={selected?.key === tier.key}
                label={`${tier.name} (${formatCredit(tier.credit, webLocale)})`}
                purpose={tier.purpose}
                onClick={() => chooseTier(tier)}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
