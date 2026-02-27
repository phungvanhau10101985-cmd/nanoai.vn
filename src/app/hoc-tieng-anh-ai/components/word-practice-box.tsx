'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { LocalTextFn, WordPracticeProgress } from './types'

type WordPracticeBoxProps = {
  targetWord: string
  expectedMeaning?: string
  wordPractice: WordPracticeProgress | null
  practiceInputStatus: 'idle' | 'partial' | 'correct' | 'incorrect'
  localText: LocalTextFn
  onStartWordPractice: (word: string, expectedMeaning?: string) => void
  onWordPracticeDraftChange: (targetWord: string, nextDraft: string) => void
  onWordPracticeMeaningSelect: (targetWord: string, selectedMeaning: string) => void
  onCancelWordPractice: () => void
}

const normalizeWordPracticeText = (text: string): string => String(text || '').trim().toLowerCase()

export function WordPracticeBox({
  targetWord,
  expectedMeaning,
  wordPractice,
  practiceInputStatus,
  localText,
  onStartWordPractice,
  onWordPracticeDraftChange,
  onWordPracticeMeaningSelect,
  onCancelWordPractice,
}: WordPracticeBoxProps) {
  const normalizedTarget = normalizeWordPracticeText(targetWord)
  const active = wordPractice && wordPractice.normalizedTarget === normalizedTarget ? wordPractice : null
  if (!active) {
    return (
      <div className="mt-1 rounded-md border bg-white p-2">
        <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => onStartWordPractice(targetWord, expectedMeaning)}>
          {localText('Luyện gõ từ này (3 lần)', 'Practice typing this word (3 times)')}
        </Button>
      </div>
    )
  }
  return (
    <div className="mt-1 rounded-md border bg-white p-2">
      <p className="text-[11px] text-slate-700">
        {active.unlocked
          ? localText('Đã hoàn thành gõ từ 3 lần. Bạn có thể tiếp tục thao tác khác.', 'Typing practice completed 3/3. You can continue other actions.')
          : localText(
              `Gõ lại đúng từ "${active.targetWord}" 3 lần để mở khóa thao tác khác. Đúng: ${active.correctCount}/3`,
              `Type "${active.targetWord}" correctly 3 times to unlock other actions. Correct: ${active.correctCount}/3`
            )}
      </p>
      {!active.unlocked ? (
        <>
          <div className="flex items-center">
            <Input
              value={active.draft}
              onChange={(e) => onWordPracticeDraftChange(targetWord, e.target.value)}
              placeholder={localText('Gõ lại từ mới...', 'Type the new word...')}
              className={cn(
                'mt-1 h-8 text-xs',
                practiceInputStatus === 'correct' && 'border-emerald-500 bg-emerald-50 focus:ring-emerald-500',
                practiceInputStatus === 'partial' && 'border-sky-300 bg-sky-50 focus:ring-sky-400',
                practiceInputStatus === 'incorrect' && 'border-rose-500 bg-rose-50 focus:ring-rose-500'
              )}
              disabled={active.awaitingMeaningChoice}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-2 mt-1 h-8 px-2 text-xs text-slate-500"
              onClick={onCancelWordPractice}
            >
              {localText('Hủy', 'Cancel')}
            </Button>
          </div>
          {active.awaitingMeaningChoice && active.meaningOptions.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {active.meaningOptions.map((option, idx) => (
                <Button
                  key={`meaning-option-${normalizedTarget}-${idx}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => onWordPracticeMeaningSelect(targetWord, option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {active.feedback ? (
        <p className={`mt-1 text-[11px] ${active.feedback.includes('Sai') || active.feedback.includes('Wrong') ? 'text-rose-700' : 'text-emerald-700'}`}>
          {active.feedback}
        </p>
      ) : null}
    </div>
  )
}
