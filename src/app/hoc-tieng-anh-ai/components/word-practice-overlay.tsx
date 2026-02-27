'use client'

import { useState } from 'react'
import { Loader2, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { WordPracticeProgress } from './types'

type WordPracticeOverlayProps = {
  wordPractice: WordPracticeProgress | null
  practiceInputStatus: 'idle' | 'partial' | 'correct' | 'incorrect'
  t: (key: string, params?: Record<string, string | number>) => string
  onWordPracticeDraftChange: (targetWord: string, nextDraft: string) => void
  onWordPracticeMeaningSelect: (targetWord: string, selectedMeaning: string) => void
  onPlayWordPronunciation: (word: string) => void | Promise<void>
  onRegenerateWordPronunciation?: (word: string) => void | Promise<void>
}

export function WordPracticeOverlay({
  wordPractice,
  practiceInputStatus,
  t,
  onWordPracticeDraftChange,
  onWordPracticeMeaningSelect,
  onPlayWordPronunciation,
  onRegenerateWordPronunciation,
}: WordPracticeOverlayProps) {
  const [replayBusy, setReplayBusy] = useState(false)
  if (!wordPractice || wordPractice.unlocked) return null

  const displayWord = wordPractice.targetWord.charAt(0).toUpperCase() + wordPractice.targetWord.slice(1)

  const handleReplay = async () => {
    if (replayBusy) return
    setReplayBusy(true)
    try {
      await Promise.resolve(onPlayWordPronunciation(wordPractice.targetWord))
    } finally {
      setReplayBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:items-center sm:p-4">
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border bg-white p-5 shadow-xl sm:max-h-[calc(100dvh-2rem)]">
        <h3 className="text-lg font-semibold text-slate-900">
          {t('Required new-word practice')}
        </h3>
        <p className="mt-1 break-words text-sm text-slate-600">
          {t('Listen and type the word correctly 3 times, then choose the correct meaning each round.')}
        </p>
        <p className="mt-1 text-sm font-medium text-slate-800">
          {t('Current word:')} {displayWord}
        </p>
        <p className="mt-1 break-words text-xs text-slate-500">
          {t('You are doing great! Complete 3/3 and you can continue right away.')}
        </p>
        <p className="mt-1 text-sm font-medium text-slate-800">
          {t('Progress:')} {wordPractice.correctCount}/3
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={replayBusy}
            onClick={() => void handleReplay()}
            className={replayBusy ? 'ring-2 ring-indigo-300' : 'transition-all active:scale-95'}
          >
            {replayBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Volume2 className="mr-2 h-4 w-4" />
            )}
            {t('Replay new word')}
          </Button>
          {onRegenerateWordPronunciation ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void onRegenerateWordPronunciation(wordPractice.targetWord)}
              title={t('Wrong pronunciation? Regenerate with TTS')}
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
            >
              {t('Wrong? Regenerate')}
            </Button>
          ) : null}
        </div>

        {!wordPractice.awaitingMeaningChoice ? (
          <div className="mt-3">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t('Type the exact word:')}
            </label>
            <Input
              value={wordPractice.draft}
              onChange={(e) => onWordPracticeDraftChange(wordPractice.targetWord, e.target.value)}
              placeholder={t('Type the new word...')}
              className={cn(
                'h-11 text-base',
                practiceInputStatus === 'correct' && 'border-emerald-500 bg-emerald-50 focus-visible:ring-emerald-500',
                practiceInputStatus === 'partial' && 'border-sky-300 bg-sky-50 focus-visible:ring-sky-400',
                practiceInputStatus === 'incorrect' && 'border-rose-500 bg-rose-50 focus-visible:ring-rose-500'
              )}
              autoFocus
            />
          </div>
        ) : (
          <div className="mt-3">
            <p className="mb-2 text-sm font-medium text-slate-700">{t('Choose the correct meaning:')}</p>
            <div className="max-h-52 space-y-2 overflow-auto pr-1">
              {wordPractice.meaningOptions.map((option, idx) => (
                <Button
                  key={`practice-meaning-option-${idx}`}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[40px] w-full justify-start whitespace-normal text-left"
                  onClick={() => onWordPracticeMeaningSelect(wordPractice.targetWord, option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        )}

        {wordPractice.feedback ? (
          <p className={`mt-3 text-sm ${wordPractice.feedback.includes('Sai') || wordPractice.feedback.includes('Wrong') ? 'text-rose-700' : 'text-emerald-700'}`}>
            {wordPractice.feedback}
          </p>
        ) : null}
      </div>
    </div>
  )
}
