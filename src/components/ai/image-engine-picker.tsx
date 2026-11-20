'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  FLUX_IMAGE_CREDITS,
  GPT_IMAGE_CREDITS,
  parseFluxImageQuality,
  type FluxImageQuality,
  type GeminiImageQuality,
  type GptImageQuality,
  type ImageEngine,
} from '@/lib/ai/image-engine'
import { publicFluxImageName, publicGeminiImageName, publicGptImageName } from '@/lib/ai/nanoai-image-names'
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
  | { key: string; engine: 'gemini' | 'flux'; quality: FluxImageQuality; name: string; credit: number; purpose?: string }

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
  engines = ['gemini', 'gpt', 'flux'],
  qualityPurpose,
  triggerClassName,
  showCredit = true,
}: {
  locale: string
  engine: ImageEngine
  onEngineChange: (engine: ImageEngine) => void
  geminiQuality?: FluxImageQuality
  onGeminiQualityChange?: (quality: FluxImageQuality) => void
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
  qualityPurpose?: Partial<Record<GptImageQuality | 'gemini2k' | 'gemini4k' | 'flux15k' | 'flux2k' | 'flux4k', string>>
  /** Lớp thêm cho nút đang chọn — thanh Hub dùng bản thấp hơn. */
  triggerClassName?: string
  /** Chat mới / chưa tới bước tạo ảnh thì ẩn số credit trên nút và trong menu. */
  showCredit?: boolean
}) {
  const webLocale: WebLocale = locale === 'en' || locale === 'zh' || locale === 'ja' || locale === 'ko' ? locale : 'vi'
  const t = getDictionary(webLocale).imageGenerationClient
  const allowGemini = engines.includes('gemini')
  const allowGpt = engines.includes('gpt')
  const allowFlux = engines.includes('flux')
  const shownGeminiQuality: GeminiImageQuality =
    geminiCost4k != null && geminiQuality === '4K' ? '4K' : '2K'
  const parsedFlux = parseFluxImageQuality(geminiQuality)
  const shownFluxQuality: FluxImageQuality = geminiCost4k == null && parsedFlux === '4K' ? '2K' : parsedFlux
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
  if (allowFlux) {
    tiers.push({
      key: 'flux-1.5k',
      engine: 'flux',
      quality: '1.5K',
      name: publicFluxImageName('1.5K'),
      credit: FLUX_IMAGE_CREDITS['1.5K'],
      purpose: qualityPurpose?.flux15k,
    })
    tiers.push({
      key: 'flux-2k',
      engine: 'flux',
      quality: '2K',
      name: publicFluxImageName('2K'),
      credit: FLUX_IMAGE_CREDITS['2K'],
      purpose: qualityPurpose?.flux2k,
    })
    if (geminiCost4k != null) {
      tiers.push({
        key: 'flux-4k',
        engine: 'flux',
        quality: '4K',
        name: publicFluxImageName('4K'),
        credit: FLUX_IMAGE_CREDITS['4K'],
        purpose: qualityPurpose?.flux4k,
      })
    }
  }
  const selected = tiers.find((tier) => {
    if (tier.engine === 'gpt') return engine === 'gpt' && gptQuality === tier.quality
    if (tier.engine === 'flux') return engine === 'flux' && shownFluxQuality === tier.quality
    return engine === 'gemini' && shownGeminiQuality === tier.quality
  })
  const selectedName = selected?.name
    ?? (engine === 'gpt'
      ? publicGptImageName(gptQuality)
      : engine === 'flux'
        ? publicFluxImageName(shownFluxQuality)
        : publicGeminiImageName(shownGeminiQuality))
  const selectedCredit = selected?.credit
    ?? (engine === 'gpt'
      ? GPT_IMAGE_CREDITS[gptQuality]
      : engine === 'flux'
        ? FLUX_IMAGE_CREDITS[shownFluxQuality]
        : shownGeminiQuality === '4K' && geminiCost4k != null
          ? geminiCost4k
          : geminiCost2k)
  const creditLabel = formatCredit(selectedCredit, webLocale)
  const triggerLabel = showCredit ? `${selectedName} (${creditLabel})` : selectedName
  const hasPurpose = tiers.some((tier) => Boolean(tier.purpose))

  function chooseTier(tier: PickerTier) {
    if (tier.engine === 'gpt') {
      if (!allowGpt) return
      if (engine !== 'gpt') onEngineChange('gpt')
      onGptQualityChange(tier.quality)
    } else if (tier.engine === 'flux') {
      if (!allowFlux) return
      if (engine !== 'flux') onEngineChange('flux')
      onGeminiQualityChange?.(tier.quality)
    } else {
      if (!allowGemini) return
      if (engine !== 'gemini') onEngineChange('gemini')
      onGeminiQualityChange?.(tier.quality)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 max-w-full shrink-0 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2.5 text-xs font-medium text-violet-900 hover:bg-violet-100',
            triggerClassName
          )}
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
                label={showCredit ? `${tier.name} (${formatCredit(tier.credit, webLocale)})` : tier.name}
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
