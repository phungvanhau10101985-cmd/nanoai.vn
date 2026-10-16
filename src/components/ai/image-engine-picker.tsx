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

export function ImageEnginePicker({
  locale,
  engine,
  onEngineChange,
  geminiQuality,
  onGeminiQualityChange,
  gptQuality,
  onGptQualityChange,
  geminiCost2k,
  geminiCost4k,
}: {
  locale: string
  engine: ImageEngine
  onEngineChange: (engine: ImageEngine) => void
  geminiQuality: '2K' | '4K'
  onGeminiQualityChange: (quality: '2K' | '4K') => void
  gptQuality: GptImageQuality
  onGptQualityChange: (quality: GptImageQuality) => void
  geminiCost2k: number
  /** `null` hoặc bỏ trống: tool khóa 2K, không hiện nút 4K. */
  geminiCost4k?: number | null
}) {
  const webLocale: WebLocale = locale === 'en' || locale === 'zh' || locale === 'ja' || locale === 'ko' ? locale : 'vi'
  const t = getDictionary(webLocale).imageGenerationClient
  const shownGeminiQuality = geminiCost4k == null ? '2K' : geminiQuality
  const [open, setOpen] = useState(false)
  /** Engine đang xem trong hộp. Khác engine đã lưu thì mọi mức chất lượng đều chưa chọn. */
  const [draftEngine, setDraftEngine] = useState<ImageEngine | null>(null)
  const shownEngine = draftEngine ?? engine
  const qualityPending = draftEngine != null && draftEngine !== engine
  const engineName = shownEngine === 'gemini' ? t.imageEngineGemini : t.imageEngineGpt
  const qualityLabel = qualityPending
    ? t.imageEnginePickQuality
    : shownEngine === 'gemini'
      ? `${shownGeminiQuality} (${formatCredit(shownGeminiQuality === '4K' && geminiCost4k != null ? geminiCost4k : geminiCost2k, webLocale)})`
      : `${gptQuality} (${formatCredit(GPT_IMAGE_CREDITS[gptQuality], webLocale)})`
  const qualityCols = shownEngine === 'gpt' ? 'grid-cols-3' : geminiCost4k != null ? 'grid-cols-2' : 'grid-cols-1'
  const geminiQualityChosen = !qualityPending && engine === 'gemini'
  const gptQualityChosen = !qualityPending && engine === 'gpt'

  function handleOpenChange(next: boolean) {
    if (!next && qualityPending) return
    setOpen(next)
    if (!next) setDraftEngine(null)
  }

  function chooseEngine(next: ImageEngine) {
    setDraftEngine(next === engine ? null : next)
  }

  function chooseGeminiQuality(quality: '2K' | '4K') {
    if (shownEngine !== 'gemini') return
    if (engine !== 'gemini') onEngineChange('gemini')
    onGeminiQualityChange(quality)
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
        className="z-[2147483647] w-[17rem] p-3"
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
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t.imageEngineLabel}</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
              <button
                type="button"
                onClick={() => chooseEngine('gemini')}
                className={chipClass(shownEngine === 'gemini')}
                aria-pressed={shownEngine === 'gemini'}
              >
                {t.imageEngineGemini}
              </button>
              <button
                type="button"
                onClick={() => chooseEngine('gpt')}
                className={chipClass(shownEngine === 'gpt')}
                aria-pressed={shownEngine === 'gpt'}
              >
                {t.imageEngineGpt}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t.imageEngineQuality}</p>
            {qualityPending ? <p className="text-[11px] leading-snug text-amber-700">{t.imageEnginePickQuality}</p> : null}
            {shownEngine === 'gemini' ? (
              <div className={cn('grid gap-1 rounded-lg bg-muted/60 p-1', qualityCols)}>
                <button
                  type="button"
                  onClick={() => chooseGeminiQuality('2K')}
                  className={chipClass(geminiQualityChosen && shownGeminiQuality === '2K')}
                  aria-pressed={geminiQualityChosen && shownGeminiQuality === '2K'}
                >
                  2K ({formatCredit(geminiCost2k, webLocale)})
                </button>
                {geminiCost4k != null ? (
                  <button
                    type="button"
                    onClick={() => chooseGeminiQuality('4K')}
                    className={chipClass(geminiQualityChosen && geminiQuality === '4K')}
                    aria-pressed={geminiQualityChosen && geminiQuality === '4K'}
                  >
                    4K ({formatCredit(geminiCost4k, webLocale)})
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
                {(['low', 'medium', 'high'] as const).map((quality) => (
                  <button
                    key={quality}
                    type="button"
                    onClick={() => chooseGptQuality(quality)}
                    className={chipClass(gptQualityChosen && gptQuality === quality)}
                    aria-pressed={gptQualityChosen && gptQuality === quality}
                  >
                    {quality} ({formatCredit(GPT_IMAGE_CREDITS[quality], webLocale)})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
