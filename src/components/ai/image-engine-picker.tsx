'use client'

import { GPT_IMAGE_CREDITS, type GptImageQuality, type ImageEngine } from '@/lib/ai/image-engine'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

function formatCredit(value: number, locale: WebLocale): string {
  return value.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })
}

function choiceClass(active: boolean): string {
  return active
    ? 'border-violet-500 bg-violet-50 text-violet-800'
    : 'border-gray-200 bg-white text-muted-foreground hover:bg-gray-50'
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
  const button = 'flex-1 px-2 py-2 rounded-md border text-xs font-medium transition-colors'
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.imageEngineLabel}</h4>
        <div className="flex gap-2">
          <button type="button" onClick={() => onEngineChange('gemini')} className={`${button} ${choiceClass(engine === 'gemini')}`}>
            {t.imageEngineGemini}
          </button>
          <button type="button" onClick={() => onEngineChange('gpt')} className={`${button} ${choiceClass(engine === 'gpt')}`}>
            {t.imageEngineGpt}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.imageEngineQuality}</h4>
        {engine === 'gemini' ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => onGeminiQualityChange('2K')} className={`${button} ${choiceClass(geminiQuality === '2K')}`}>
              2K ({formatCredit(geminiCost2k, webLocale)})
            </button>
            {geminiCost4k != null ? (
              <button type="button" onClick={() => onGeminiQualityChange('4K')} className={`${button} ${choiceClass(geminiQuality === '4K')}`}>
                4K ({formatCredit(geminiCost4k, webLocale)})
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((quality) => (
              <button
                key={quality}
                type="button"
                onClick={() => onGptQualityChange(quality)}
                className={`${button} ${choiceClass(gptQuality === quality)}`}
              >
                {quality} ({formatCredit(GPT_IMAGE_CREDITS[quality], webLocale)})
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
