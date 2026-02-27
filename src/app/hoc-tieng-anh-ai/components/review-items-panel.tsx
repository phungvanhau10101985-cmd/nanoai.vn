'use client'

import { Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LocalTextFn, VocabularyItem } from './types'

type ReviewItemsPanelProps = {
  localText: LocalTextFn
  reviewBusy: boolean
  reviewItems: VocabularyItem[]
  writingRomanizationByKey: Record<string, string>
  writingRomanizationBusyByKey: Record<string, boolean>
  toWritingRomanizationKey: (text: string, targetLang?: string) => string
  isCjkTargetLanguage: (targetLanguage?: string) => boolean
  onRefreshReviewItems: () => void
  onStartWordPractice: (word: string, expectedMeaning?: string, opts?: { forceSwitch?: boolean }) => void
  onPlayWordTextSnippet: (text: string) => void
  onPlayWordPronunciation: (word: string) => void
  onRegenerateWordPronunciation?: (word: string) => void
  onMarkReviewDone: (id: string, quality: number) => void
}

export function ReviewItemsPanel({
  localText,
  reviewBusy,
  reviewItems,
  writingRomanizationByKey,
  writingRomanizationBusyByKey,
  toWritingRomanizationKey,
  isCjkTargetLanguage,
  onRefreshReviewItems,
  onStartWordPractice,
  onPlayWordTextSnippet,
  onPlayWordPronunciation,
  onRegenerateWordPronunciation,
  onMarkReviewDone,
}: ReviewItemsPanelProps) {
  const usageTagLabel = (level?: 'high' | 'medium' | 'low') => {
    if (level === 'high') return localText('Dùng nhiều', 'High use')
    if (level === 'low') return localText('Ít dùng', 'Low use')
    return localText('Dùng trung bình', 'Medium use')
  }

  const usageTagClass = (level?: 'high' | 'medium' | 'low') => {
    if (level === 'high') return 'border-blue-300 bg-blue-50 text-blue-700'
    if (level === 'low') return 'border-amber-300 bg-amber-50 text-amber-700'
    return 'border-emerald-300 bg-emerald-50 text-emerald-700'
  }

  const renderExamples = (item: VocabularyItem) => {
    const itemExamples =
      (item.exampleItems ?? []).length > 0
        ? item.exampleItems!
        : item.exampleTarget && item.exampleNative
          ? [{ targetText: item.exampleTarget, nativeText: item.exampleNative, targetPinyin: undefined }]
          : []

    return itemExamples.map((ex, idx) => {
      const exampleText = String(ex.targetText || '').trim()
      const exampleNative = String(ex.nativeText || '').trim()
      const storedPinyin = String(ex.targetPinyin || '').trim()
      const itemTargetLang = item.targetLanguage
      const fallbackKey = toWritingRomanizationKey(exampleText, itemTargetLang)
      const fallbackPinyin = String(writingRomanizationByKey[fallbackKey] || '').trim()
      const busyPinyin = Boolean(writingRomanizationBusyByKey[fallbackKey])
      const pinyin = storedPinyin || fallbackPinyin
      const showPinyin = isCjkTargetLanguage(itemTargetLang)
      if (!exampleText) return null
      const targetWord = item.word.trim()
      const cleanExampleText = exampleText.replace(/\*\*/g, '')
      const renderExampleWithHighlight = () => {
        if (!targetWord || !cleanExampleText.includes(targetWord)) return cleanExampleText
        const parts = cleanExampleText.split(targetWord)
        const displayWord = targetWord.charAt(0).toUpperCase() + targetWord.slice(1)
        return parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 ? <span className="font-semibold text-blue-600 dark:text-blue-400">{displayWord}</span> : null}
          </span>
        ))
      }

      return (
        <div key={idx} className="mt-1 space-y-0">
          <div className="flex items-start gap-2">
            <p className="flex-1">
              <span className="font-semibold text-slate-800">{localText('Ví dụ:', 'Example:')}</span>{' '}
              {renderExampleWithHighlight()}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onPlayWordTextSnippet(cleanExampleText)}
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </div>
          {showPinyin && (pinyin || busyPinyin) ? (
            pinyin ? (
              <p className="text-muted-foreground">
                <span className="font-semibold text-slate-800">{localText('Pinyin:', 'Pinyin:')}</span>{' '}
                {pinyin}
              </p>
            ) : (
              <p className="text-muted-foreground">
                <span className="font-semibold text-slate-800">{localText('Pinyin:', 'Pinyin:')}</span>{' '}
                {localText('Đang tạo...', 'Generating...')}
              </p>
            )
          ) : null}
          {exampleNative ? (
            <p className="text-muted-foreground">
              <span className="font-semibold text-slate-800">{localText('Dịch:', 'Translation:')}</span>{' '}
              {exampleNative}
            </p>
          ) : null}
        </div>
      )
    })
  }

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{localText('Ôn tập thông minh (SRS)', 'Smart review (SRS)')}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onRefreshReviewItems} disabled={reviewBusy}>
          {localText('Làm mới', 'Refresh')}
        </Button>
      </div>
      {reviewBusy ? (
        <p className="text-sm text-muted-foreground">{localText('Đang tải danh sách từ đến hạn ôn...', 'Loading words due for review...')}</p>
      ) : reviewItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{localText('Chưa có từ đến hạn ôn. Tiếp tục hội thoại để tích lũy từ mới.', 'No words due yet. Keep chatting to build vocabulary.')}</p>
      ) : (
        <div className="space-y-1.5">
          {reviewItems.map((item) => (
            <div key={item.id} className="rounded-md border bg-slate-50 p-1.5 text-xs leading-snug">
              <p>
                <button
                  type="button"
                  className="font-semibold text-blue-600 dark:text-blue-400 underline-offset-2 hover:underline"
                  onClick={() => onStartWordPractice(item.word, String(item.meaning || item.meaningItems?.[0]?.text || ''))}
                >
                  {item.word.charAt(0).toUpperCase() + item.word.slice(1)}
                </button>{' '}
                - {((item.meaningItems ?? []).map((m) => m.text).join('; ') || item.meaning || localText('Chưa có nghĩa', 'No meaning yet'))}
              </p>
              <p className="text-muted-foreground">{localText('Phát âm:', 'Pronunciation:')} {item.pronunciation || item.word}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${usageTagClass(item.usageLevel)}`}>
                  {usageTagLabel(item.usageLevel)}
                </span>
                <span className="inline-flex rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                  {localText('Ưu tiên:', 'Priority:')} {Math.max(0, Math.min(100, Number(item.importanceScore ?? 50)))}
                </span>
                {item.contextSensitive ? (
                  <span className="inline-flex rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                    {localText('Phụ thuộc ngữ cảnh', 'Context-sensitive')}
                  </span>
                ) : null}
              </div>
              {renderExamples(item)}
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => {
                    onStartWordPractice(item.word, String(item.meaning || item.meaningItems?.[0]?.text || ''), { forceSwitch: true })
                    onPlayWordPronunciation(item.word)
                  }}
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  {localText('Nghe lại từ này', 'Replay this word')}
                </Button>
                {onRegenerateWordPronunciation ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-amber-700 hover:bg-amber-50"
                    onClick={() => onRegenerateWordPronunciation(item.word)}
                    title={localText('Phát âm sai? Tạo lại bằng TTS', 'Wrong pronunciation? Regenerate with TTS')}
                  >
                    {localText('Phát âm sai? Tạo lại', 'Wrong? Regenerate')}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => onMarkReviewDone(item.id, 2)}>
                  {localText('Khó', 'Hard')}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => onMarkReviewDone(item.id, 3)}>
                  {localText('Ổn', 'Okay')}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => onMarkReviewDone(item.id, 5)}>
                  {localText('Dễ', 'Easy')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}