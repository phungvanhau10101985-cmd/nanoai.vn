'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { GPT_IMAGE_CREDITS, type GptImageQuality, type ImageEngine } from '@/lib/ai/image-engine'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function formatCredit(value: number, locale: WebLocale): string {
  return value.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })
}

function chipClass(active: boolean): string {
  return cn(
    'h-8 rounded-md px-2 text-xs font-medium transition-colors',
    active ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:bg-white'
  )
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
  if (!purpose) {
    return (
      <button type="button" onClick={onClick} className={chipClass(active)} aria-pressed={active}>
        {label}
      </button>
    )
  }
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
      <span className={cn('mt-0.5 block text-[10px] leading-snug', active ? 'text-violet-100' : 'text-muted-foreground')}>{purpose}</span>
    </button>
  )
}

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
  /** Engine được chọn. Một phần tử thì ẩn hàng đổi model. */
  engines?: readonly ImageEngine[]
  /** Một dòng mục đích dưới từng mức. Tool không truyền thì hộp giữ nút cũ. */
  qualityPurpose?: Partial<Record<GptImageQuality | 'gemini2k' | 'gemini4k', string>>
}) {
  const webLocale: WebLocale = locale === 'en' || locale === 'zh' || locale === 'ja' || locale === 'ko' ? locale : 'vi'
  const t = getDictionary(webLocale).imageGenerationClient
  const allowGemini = engines.includes('gemini')
  const allowGpt = engines.includes('gpt')
  const lockedEngine: ImageEngine | null = allowGemini && !allowGpt ? 'gemini' : allowGpt && !allowGemini ? 'gpt' : null
  const shownGeminiQuality = geminiCost4k == null ? '2K' : (geminiQuality ?? '2K')
  const [open, setOpen] = useState(false)
  /** Engine đang xem trong hộp. Khác engine đã lưu thì mọi mức chất lượng đều chưa chọn. */
  const [draftEngine, setDraftEngine] = useState<ImageEngine | null>(null)
  const shownEngine = lockedEngine ?? draftEngine ?? engine
  const qualityPending = draftEngine != null && draftEngine !== engine
  const engineName = shownEngine === 'gemini' ? t.imageEngineGemini : t.imageEngineGpt
  const qualityLabel = qualityPending
    ? t.imageEnginePickQuality
    : shownEngine === 'gemini'
      ? `${shownGeminiQuality} (${formatCredit(shownGeminiQuality === '4K' && geminiCost4k != null ? geminiCost4k : geminiCost2k, webLocale)})`
      : `${gptQuality} (${formatCredit(GPT_IMAGE_CREDITS[gptQuality], webLocale)})`
  const qualityCols = shownEngine === 'gpt'
    ? gptQualities.length <= 1
      ? 'grid-cols-1'
      : gptQualities.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3'
    : geminiCost4k != null
      ? 'grid-cols-2'
      : 'grid-cols-1'
  const geminiQualityChosen = !qualityPending && engine === 'gemini'
  const gptQualityChosen = !qualityPending && engine === 'gpt'
  const purposeForShown = shownEngine === 'gemini'
    ? [qualityPurpose?.gemini2k, geminiCost4k != null ? qualityPurpose?.gemini4k : undefined].some(Boolean)
    : gptQualities.some((quality) => Boolean(qualityPurpose?.[quality]))

  function handleOpenChange(next: boolean) {
    if (!next && qualityPending) return
    setOpen(next)
    if (!next) setDraftEngine(null)
  }

  function chooseEngine(next: ImageEngine) {
    if (lockedEngine || !engines.includes(next)) return
    setDraftEngine(next === engine ? null : next)
  }

  function chooseGeminiQuality(quality: '2K' | '4K') {
    if (shownEngine !== 'gemini' || !allowGemini) return
    if (engine !== 'gemini') onEngineChange('gemini')
    onGeminiQualityChange?.(quality)
    setDraftEngine(null)
    setOpen(false)
  }

  function chooseGptQuality(quality: GptImageQuality) {
    if (shownEngine !== 'gpt') return
    if (engine !== 'gpt') onEngineChange('gpt')
    onGptQualityChange(quality)
    setDraftEngine(null)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 max-w-full shrink-0 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2.5 text-xs font-medium text-violet-900 hover:bg-violet-100"
          aria-label={`${t.imageEngineLabel}: ${engineName}. ${t.imageEngineQuality}: ${qualityLabel}`}
        >
          <span className="truncate">{engineName}</span>
          <span className="text-violet-300" aria-hidden>
            ·
          </span>
          <span className="whitespace-nowrap">{qualityLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      {/* Picker nằm trong dialog z-[200], sheet z-[550], Hub Studio toàn màn z max: menu phải nổi trên mọi lớp. */}
      <PopoverContent
        align="end"
        side="top"
        collisionPadding={12}
        className={cn('z-[2147483647] p-3', purposeForShown ? 'w-[22rem]' : 'w-[17rem]')}
        onPointerDownOutside={(event) => {
          if (qualityPending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (qualityPending) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (qualityPending) event.preventDefault()
        }}
      >
        <div className="space-y-3">
          {lockedEngine ? null : (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t.imageEngineLabel}</p>
            <div className={cn('grid gap-1 rounded-lg bg-muted/60 p-1', allowGemini && allowGpt ? 'grid-cols-2' : 'grid-cols-1')}>
              {allowGemini ? (
              <button
                type="button"
                onClick={() => chooseEngine('gemini')}
                className={chipClass(shownEngine === 'gemini')}
                aria-pressed={shownEngine === 'gemini'}
              >
                {t.imageEngineGemini}
              </button>
              ) : null}
              {allowGpt ? (
              <button
                type="button"
                onClick={() => chooseEngine('gpt')}
                className={chipClass(shownEngine === 'gpt')}
                aria-pressed={shownEngine === 'gpt'}
              >
                {t.imageEngineGpt}
              </button>
              ) : null}
            </div>
          </div>
          )}
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t.imageEngineQuality}</p>
            {qualityPending ? <p className="text-[11px] leading-snug text-amber-700">{t.imageEnginePickQuality}</p> : null}
            {shownEngine === 'gemini' ? (
              <div className={cn(purposeForShown ? 'space-y-1' : cn('grid gap-1 rounded-lg bg-muted/60 p-1', qualityCols))}>
                <QualityChoice
                  active={geminiQualityChosen && shownGeminiQuality === '2K'}
                  label={`2K (${formatCredit(geminiCost2k, webLocale)})`}
                  purpose={qualityPurpose?.gemini2k}
                  onClick={() => chooseGeminiQuality('2K')}
                />
                {geminiCost4k != null ? (
                  <QualityChoice
                    active={geminiQualityChosen && geminiQuality === '4K'}
                    label={`4K (${formatCredit(geminiCost4k, webLocale)})`}
                    purpose={qualityPurpose?.gemini4k}
                    onClick={() => chooseGeminiQuality('4K')}
                  />
                ) : null}
              </div>
            ) : (
              <div className={cn(purposeForShown ? 'space-y-1' : cn('grid gap-1 rounded-lg bg-muted/60 p-1', qualityCols))}>
                {gptQualities.map((quality) => (
                  <QualityChoice
                    key={quality}
                    active={gptQualityChosen && gptQuality === quality}
                    label={`${quality} (${formatCredit(GPT_IMAGE_CREDITS[quality], webLocale)})`}
                    purpose={qualityPurpose?.[quality]}
                    onClick={() => chooseGptQuality(quality)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
