'use client'

import { Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LocalTextFn, VocabularyItem } from './types'

type TodayWordsPanelProps = {
  localText: LocalTextFn
  todayWordsBusy: boolean
  todayWords: VocabularyItem[]
  writingRomanizationByKey: Record<string, string>
  writingRomanizationBusyByKey: Record<string, boolean>
  toWritingRomanizationKey: (text: string, targetLang?: string) => string
  isCjkTargetLanguage: (targetLanguage?: string) => boolean
  onRefreshTodayWords: () => void
  onStartWordPractice: (word: string, expectedMeaning?: string, opts?: { forceSwitch?: boolean }) => void
  onPlayWordTextSnippet: (text: string) => void
  onPlayWordPronunciation: (word: string) => void
}

export function TodayWordsPanel({
  localText,
  todayWordsBusy,
  todayWords,
  writingRomanizationByKey,
  writingRomanizationBusyByKey,
  toWritingRomanizationKey,
  isCjkTargetLanguage,
  onRefreshTodayWords,
  onStartWordPractice,
  onPlayWordTextSnippet,
  onPlayWordPronunciation,
}: TodayWordsPanelProps) {
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{localText('Từ mới của buổi học này', 'New words in this lesson')}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onRefreshTodayWords} disabled={todayWordsBusy}>
          {localText('Làm mới', 'Refresh')}
        </Button>
      </div>
      {todayWordsBusy ? (
        <p className="text-sm text-muted-foreground">{localText('Đang tải danh sách từ mới của buổi học...', 'Loading new words for this lesson...')}</p>
      ) : todayWords.length === 0 ? (
        <p className="text-sm text-muted-foreground">{localText('Chưa có từ mới trong buổi này. Bấm vào từ trong câu teacher để lưu.', 'No new words yet. Tap words in teacher sentences to save them.')}</p>
      ) : (
        <div className="space-y-1.5">
          {todayWords.map((item) => (
            <div key={item.id} className="rounded-md border bg-slate-50 p-1.5 text-xs leading-snug">
              <p>
                <button
                  type="button"
                  className="font-semibold text-blue-600 dark:text-blue-400 underline-offset-2 hover:underline"
                  onClick={() => onStartWordPractice(item.word, String(item.meaning || ''))}
                >
                  {item.word.charAt(0).toUpperCase() + item.word.slice(1)}
                </button>{' '}
                - {item.meaning || localText('Chưa có nghĩa', 'No meaning yet')}
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
              <div className="mt-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => {
                    onStartWordPractice(item.word, String(item.meaning || ''), { forceSwitch: true })
                    onPlayWordPronunciation(item.word)
                  }}
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  {localText('Nghe lại từ này', 'Replay this word')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}