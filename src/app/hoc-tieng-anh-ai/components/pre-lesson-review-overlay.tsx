'use client'

import { useEffect, useRef, useState } from 'react'
import { Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { LocalTextFn, PreLessonWordItem } from './types'

type PreLessonReviewOverlayProps = {
  words: PreLessonWordItem[]
  exerciseIndex: number
  wordIndex: number
  results: Record<string, { cloze: boolean; listen: boolean; recall: boolean }>
  input: string
  recallDirection: 'word' | 'meaning'
  passed: boolean
  languageCode: string
  /** Bắt buộc: map targetLanguage (và word khi cần) → languageCode. Ôn bài cũ luôn theo ngôn ngữ gốc của từ, không theo ngôn ngữ đang học. */
  targetLangToLanguageCode: (targetLanguage?: string, word?: string) => string
  onInputChange: (v: string) => void
  onRecallDirectionChange: (v: 'word' | 'meaning') => void
  onClozeSubmit: (word: string, correct: boolean) => void
  onListenSubmit: (word: string, correct: boolean) => void
  onRecallSubmit: (word: string, correct: boolean) => void
  onStartNewLesson: () => void
  onPlayWord: (word: string, pronunciationAudioUrl?: string, wordItem?: PreLessonWordItem) => void
  onRegenerateWordAudio?: (word: string, wordItem: PreLessonWordItem) => void
  onClose: () => void
  localText: LocalTextFn
}

function normalizeWordForCompare(w: string): string {
  const s = String(w || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .normalize('NFC')
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Rút ngắn nghĩa hiển thị và loại bỏ từ đích ở đầu để không lộ đáp án. Ưu tiên lấy từ "có nghĩa là" hoặc "nghĩa là" trở đi. */
function formatDisplayMeaning(fullMeaning: string, targetWord: string, maxLen = 120): string {
  let s = String(fullMeaning || '').trim()
  if (!s) return ''
  const idx1 = s.toLowerCase().indexOf('có nghĩa là')
  const idx2 = s.toLowerCase().indexOf('nghĩa là')
  if (idx1 >= 0) s = s.slice(idx1).trim()
  else if (idx2 >= 0) s = s.slice(idx2).trim()
  else {
    const escaped = escapeRegex(targetWord)
    s = s.replace(new RegExp(`^\\s*["']?${escaped}["']?\\s*(\\([^)]*\\))?\\s*`, 'i'), '').trim()
  }
  if (s.length > maxLen) s = s.slice(0, maxLen) + '...'
  if (s.length > 0) s = s.charAt(0).toUpperCase() + s.slice(1)
  return s
}

export function PreLessonReviewOverlay({
  words,
  exerciseIndex,
  wordIndex,
  results,
  input,
  recallDirection,
  passed,
  languageCode,
  targetLangToLanguageCode,
  onInputChange,
  onRecallDirectionChange,
  onClozeSubmit,
  onListenSubmit,
  onRecallSubmit,
  onStartNewLesson,
  onPlayWord,
  onRegenerateWordAudio,
  onClose,
  localText,
}: PreLessonReviewOverlayProps) {
  void results
  const [wrongHint, setWrongHint] = useState<{ word: string; meaning: string; pronunciation?: string; type: 'cloze' | 'listen' | 'recall' } | null>(null)
  const [inputCheckStatus, setInputCheckStatus] = useState<'idle' | 'partial' | 'correct' | 'incorrect'>('idle')
  const [compositionEndAt, setCompositionEndAt] = useState(0)
  const autoPlayedListenWordRef = useRef<Record<string, true>>({})
  const autoPlayedHintRef = useRef<string | null>(null)
  const submittedRef = useRef(false)
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isComposingRef = useRef(false)
  const onClozeSubmitRef = useRef(onClozeSubmit)
  const onListenSubmitRef = useRef(onListenSubmit)
  onClozeSubmitRef.current = onClozeSubmit
  onListenSubmitRef.current = onListenSubmit
  const currentWord = words[wordIndex]
  /** Ngôn ngữ gốc của từ – từ DB (targetLanguage), không dùng ngôn ngữ phiên học */
  const wordLanguageCode = targetLangToLanguageCode(currentWord?.targetLanguage, currentWord?.word) || languageCode
  const isCjk = wordLanguageCode === 'zh' || wordLanguageCode === 'ja' || wordLanguageCode === 'ko' || wordLanguageCode === 'th' || wordLanguageCode === 'hi'
  const ex0 = exerciseIndex === 0
  const ex1 = exerciseIndex === 1
  const ex2 = exerciseIndex === 2
  const exampleSentence = (currentWord?.exampleItems?.[0]?.targetText || currentWord?.exampleTarget || '').trim()
  const targetWord = String(currentWord?.word || '').trim()
  const correctMeaning = (currentWord?.meaning || currentWord?.meaningItems?.[0]?.text || '').trim()
  const displayMeaning = formatDisplayMeaning(correctMeaning, targetWord, 120)

  useEffect(() => {
    setWrongHint(null)
    setInputCheckStatus('idle')
    setCompositionEndAt(0)
    submittedRef.current = false
    autoPlayedHintRef.current = null
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current)
      submitTimerRef.current = null
    }
  }, [wordIndex, exerciseIndex])

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) {
        clearTimeout(submitTimerRef.current)
        submitTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (wrongHint) setInputCheckStatus('idle')
  }, [wrongHint])

  // Khi chuyển sang ô gợi ý, tự động phát từ một lần.
  useEffect(() => {
    if (!wrongHint || !currentWord) return
    const hintKey = `${wordIndex}-${exerciseIndex}-${wrongHint.word}`
    if (autoPlayedHintRef.current === hintKey) return
    autoPlayedHintRef.current = hintKey
    const t = setTimeout(() => onPlayWord(wrongHint.word, currentWord.pronunciationAudioUrl, currentWord), 400)
    return () => clearTimeout(t)
  }, [wrongHint, currentWord, wordIndex, exerciseIndex, onPlayWord])

  // Reset auto-play marks for each fresh listening pass.
  useEffect(() => {
    if (exerciseIndex === 1 && wordIndex === 0) {
      autoPlayedListenWordRef.current = {}
    }
  }, [exerciseIndex, wordIndex])

  // Bài nghe (ex1): thử tự phát sau 600ms. Trình duyệt thường chặn autoplay → nút "Bấm để nghe" là fallback chắc chắn.
  useEffect(() => {
    if (exerciseIndex !== 1 || !currentWord || wrongHint) return
    const autoPlayKey = `${wordIndex}::${normalizeWordForCompare(currentWord.word)}`
    if (!autoPlayKey) return
    if (autoPlayedListenWordRef.current[autoPlayKey]) return
    autoPlayedListenWordRef.current[autoPlayKey] = true
    const t = setTimeout(() => onPlayWord(currentWord.word, currentWord.pronunciationAudioUrl, currentWord), 600)
    return () => clearTimeout(t)
  }, [exerciseIndex, wordIndex, currentWord, wrongHint, onPlayWord])

  const handleContinueAfterWrong = () => {
    if (!wrongHint || !currentWord) return
    if (wrongHint.type === 'cloze') onClozeSubmit(currentWord.word, false)
    else if (wrongHint.type === 'listen') onListenSubmit(currentWord.word, false)
    else onRecallSubmit(currentWord.word, false)
    setWrongHint(null)
  }

  const exerciseLabels = [
    localText('1. Điền từ vào câu ví dụ, hoặc gõ từ theo nghĩa', '1. Fill word in example sentence, or type word by meaning'),
    localText('2. Nghe và gõ từ', '2. Listen and type the word'),
    localText('3. Recall 2 chiều (từ ↔ nghĩa)', '3. Two-way recall (word ↔ meaning)'),
  ]

  useEffect(() => {
    if (!currentWord || wrongHint || submittedRef.current) return
    if (!ex0 && !ex1) return

    const normalizedInput = normalizeWordForCompare(input)
    if (!normalizedInput) {
      setInputCheckStatus('idle')
      return
    }

    const justComposed = compositionEndAt > 0 && Date.now() - compositionEndAt < 600
    const inputLen = normalizedInput.length
    const targetLen = normalizeWordForCompare(targetWord).length
    const lengthMatches = isCjk && inputLen > 0 && inputLen === targetLen
    const checkDebounceMs = justComposed ? 200 : lengthMatches ? 250 : isCjk ? 500 : 400

    const timer = setTimeout(() => {
      if (submittedRef.current || isComposingRef.current) return
      const normalizedTarget = normalizeWordForCompare(targetWord)
      const inputNfc = input.trim().normalize('NFC')
      const targetNfc = targetWord.trim().normalize('NFC')
      const exactMatch =
        normalizedInput === normalizedTarget || (inputNfc === targetNfc && inputNfc.length > 0)
      const isCorrectPrefix =
        normalizedTarget.length >= normalizedInput.length &&
        normalizedTarget.slice(0, normalizedInput.length) === normalizedInput
      if (exactMatch) {
        setInputCheckStatus('correct')
        submittedRef.current = true
        const submit = ex0 ? onClozeSubmitRef.current : onListenSubmitRef.current
        if (submitTimerRef.current) clearTimeout(submitTimerRef.current)
        submitTimerRef.current = setTimeout(() => {
          submit(currentWord.word, true)
          submitTimerRef.current = null
        }, 350)
      } else if (isCorrectPrefix) {
        setInputCheckStatus('partial')
      } else {
        setInputCheckStatus('incorrect')
      }
    }, checkDebounceMs)

    return () => clearTimeout(timer)
  }, [input, targetWord, currentWord, ex0, ex1, wrongHint, isCjk, compositionEndAt])
  /** Lấy câu ví dụ của chính từ từ DB, xóa đúng từ đó để tạo ô trống. Không sinh/cải biên thêm. */
  const clozeSentence = (() => {
    if (!exampleSentence) return ''
    const sentNfc = exampleSentence.normalize('NFC')
    const targetNfc = String(targetWord || '').trim().normalize('NFC')
    if (!targetNfc) return ''
    if (isCjk) {
      if (!sentNfc.includes(targetNfc)) return ''
      const replaced = sentNfc.replace(new RegExp(escapeRegex(targetNfc), 'gu'), '______')
      return replaced !== sentNfc ? replaced : ''
    }
    const replaced = exampleSentence.replace(new RegExp(`\\b${escapeRegex(targetWord)}\\b`, 'gi'), '______')
    return replaced !== exampleSentence ? replaced : ''
  })()

  useEffect(() => {
    if (!currentWord || wrongHint || submittedRef.current) return
    const t = setTimeout(
      () =>
        setWrongHint({
          word: targetWord,
          meaning: correctMeaning,
          pronunciation: currentWord.pronunciation,
          type: ex0 ? 'cloze' : ex1 ? 'listen' : 'recall',
        }),
      15000
    )
    return () => clearTimeout(t)
  }, [wordIndex, exerciseIndex, currentWord, targetWord, correctMeaning, ex0, ex1, wrongHint])

  useEffect(() => {
    if (!wrongHint || wrongHint.type === 'recall') return
    if (!currentWord) return

    const normalizedInput = normalizeWordForCompare(input)
    if (!normalizedInput) {
      setInputCheckStatus('idle')
      return
    }
    if (isComposingRef.current) return

    const justComposed = compositionEndAt > 0 && Date.now() - compositionEndAt < 600
    const targetNorm = normalizeWordForCompare(targetWord)
    const lengthMatches = isCjk && normalizedInput.length > 0 && normalizedInput.length === targetNorm.length
    const debounceMs = justComposed ? 200 : lengthMatches ? 250 : isCjk ? 500 : 400

    const timer = setTimeout(() => {
      setCompositionEndAt(0)
      if (!wrongHint || wrongHint.type === 'recall') return
      const normalizedTarget = normalizeWordForCompare(targetWord)
      const inputNfc = input.trim().normalize('NFC')
      const targetNfc = targetWord.trim().normalize('NFC')
      const exactMatch =
        normalizedInput === normalizedTarget || (inputNfc === targetNfc && inputNfc.length > 0)
      const isCorrectPrefix =
        normalizedTarget.length >= normalizedInput.length &&
        normalizedTarget.slice(0, normalizedInput.length) === normalizedInput
      if (exactMatch) {
        setInputCheckStatus('correct')
        submittedRef.current = true
        setWrongHint(null)
        if (submitTimerRef.current) clearTimeout(submitTimerRef.current)
        submitTimerRef.current = setTimeout(() => {
          if (wrongHint.type === 'cloze') onClozeSubmitRef.current(currentWord.word, false)
          else onListenSubmitRef.current(currentWord.word, false)
          submitTimerRef.current = null
        }, 350)
      } else if (isCorrectPrefix) {
        setInputCheckStatus('partial')
      } else {
        setInputCheckStatus('incorrect')
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [input, wrongHint, currentWord, targetWord, isCjk, compositionEndAt])

  useEffect(() => {
    if (!ex0 && !ex1) return
    if (!currentWord || wrongHint || inputCheckStatus !== 'incorrect') return
    const t = setTimeout(
      () =>
        setWrongHint({
          word: targetWord,
          meaning: correctMeaning,
          pronunciation: currentWord.pronunciation,
          type: ex0 ? 'cloze' : 'listen',
        }),
      5000
    )
    return () => clearTimeout(t)
  }, [inputCheckStatus, ex0, ex1, currentWord, targetWord, correctMeaning, wrongHint])

  const wrongMeanings = currentWord
    ? words
      .filter((w) => w.word !== currentWord.word)
      .flatMap((w) => (w.meaningItems || []).map((m) => m.text).filter(Boolean))
      .filter((m) => m !== correctMeaning)
      .slice(0, 4)
    : []
  const meaningOptions = [correctMeaning, ...wrongMeanings].slice(0, 4).sort(() => Math.random() - 0.5)

  const otherWords = currentWord ? words.filter((w) => w.word !== currentWord.word).map((w) => w.word) : []
  const wordOptions = currentWord ? [currentWord.word, ...otherWords.slice(0, 3)].sort(() => Math.random() - 0.5) : []

  const handleClozeSubmit = () => {
    if (!currentWord) return
    const correct = normalizeWordForCompare(input) === normalizeWordForCompare(targetWord)
    if (correct) {
      setInputCheckStatus('correct')
      submittedRef.current = true
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current)
      submitTimerRef.current = setTimeout(() => {
        onClozeSubmit(currentWord.word, true)
        submitTimerRef.current = null
      }, 350)
    } else {
      setInputCheckStatus('incorrect')
      setWrongHint({ word: targetWord, meaning: correctMeaning, pronunciation: currentWord.pronunciation, type: 'cloze' })
    }
  }

  const handleListenSubmit = () => {
    if (!currentWord) return
    const correct = normalizeWordForCompare(input) === normalizeWordForCompare(targetWord)
    if (correct) {
      setInputCheckStatus('correct')
      submittedRef.current = true
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current)
      submitTimerRef.current = setTimeout(() => {
        onListenSubmit(currentWord.word, true)
        submitTimerRef.current = null
      }, 350)
    } else {
      setInputCheckStatus('incorrect')
      setWrongHint({ word: targetWord, meaning: correctMeaning, pronunciation: currentWord.pronunciation, type: 'listen' })
    }
  }

  if (passed) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
        <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-lg border bg-white p-6 shadow-xl sm:max-h-[calc(100dvh-2rem)]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={localText('Đóng', 'Close')}
            className="absolute right-2 top-2 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold text-slate-900">{localText('Ôn bài cũ', 'Review previous lesson')}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {localText('Bạn đã đạt yêu cầu! Có thể bắt đầu bài mới.', 'You passed! You can start the new lesson.')}
          </p>
          <Button
            type="button"
            onClick={onStartNewLesson}
            className="mt-4 w-full min-h-[44px]"
          >
            {localText('Bắt đầu bài mới', 'Start new lesson')}
          </Button>
        </div>
      </div>
    )
  }

  if (!currentWord) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
      <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border bg-white p-6 shadow-xl sm:max-h-[calc(100dvh-2rem)]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={localText('Đóng', 'Close')}
          className="absolute right-2 top-2 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-slate-900">{localText('Ôn bài cũ', 'Review previous lesson')}</h2>
        <p className="mt-1 break-words text-xs text-slate-500">
          {localText('Từ', 'Word')} {wordIndex + 1}/{words.length} • {exerciseLabels[exerciseIndex]}
        </p>

        {wrongHint ? (
          <div className="mt-4 rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
            <p className="break-words font-medium text-amber-900">
              {localText('Gợi ý để nhớ lại (sẽ kiểm tra lại từ này lần sau):', 'Hint to remember (this word will be reviewed again):')}
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{wrongHint.word.charAt(0).toUpperCase() + wrongHint.word.slice(1)}</p>
            {wrongHint.pronunciation ? (
              <p className="mt-1 text-sm text-slate-500 italic">{wrongHint.pronunciation}</p>
            ) : null}
            {wrongHint.meaning ? (
              <p className="mt-1 text-sm text-slate-600">{localText('Nghĩa:', 'Meaning:')} {wrongHint.meaning}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPlayWord(wrongHint.word, currentWord?.pronunciationAudioUrl, currentWord ?? undefined)}
                className="active:scale-95 transition-transform"
              >
                <Volume2 className="mr-2 h-4 w-4" /> {localText('Nghe từ đúng', 'Listen to correct word')}
              </Button>
              {onRegenerateWordAudio && currentWord ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRegenerateWordAudio(wrongHint.word, currentWord)}
                  title={localText('Phát âm sai? Tạo lại bằng TTS', 'Wrong pronunciation? Regenerate with TTS')}
                  className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                >
                  {localText('Phát âm sai? Tạo lại', 'Wrong? Regenerate')}
                </Button>
              ) : null}
            </div>
            {(wrongHint.type === 'cloze' || wrongHint.type === 'listen') && (
              <div className="mt-3">
                <label className="mb-1.5 block break-words text-sm font-medium text-slate-700">
                  {localText('Gõ từ để ôn tập (đúng mới chuyển tiếp, từ này vẫn kiểm tra lại lần sau):', 'Type the word to review (correct to continue, this word will be reviewed again):')}
                </label>
                <Input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  lang={wordLanguageCode === 'zh' ? 'zh-CN' : wordLanguageCode === 'ja' ? 'ja' : wordLanguageCode === 'ko' ? 'ko' : undefined}
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  onCompositionStart={() => { isComposingRef.current = true }}
                  onCompositionEnd={(e) => {
                    isComposingRef.current = false
                    onInputChange((e.target as HTMLInputElement).value)
                    setCompositionEndAt(Date.now())
                  }}
                  placeholder={localText('Gõ từ...', 'Type the word...')}
                  className={cn(
                    'h-11 text-base',
                    inputCheckStatus === 'correct' && 'border-emerald-500 bg-emerald-50 focus-visible:ring-emerald-500',
                    inputCheckStatus === 'partial' && 'border-sky-300 bg-sky-50 focus-visible:ring-sky-400',
                    inputCheckStatus === 'incorrect' && 'border-rose-500 bg-rose-50 focus-visible:ring-rose-500'
                  )}
                  autoFocus
                />
              </div>
            )}
            {wrongHint.type === 'recall' && (
              <Button type="button" onClick={handleContinueAfterWrong} className="mt-3 w-full">
                {localText('Tiếp tục', 'Continue')}
              </Button>
            )}
          </div>
        ) : (
          <>
            {ex0 && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-2 font-medium text-slate-700">
                    {localText('📌 Nhiệm vụ: Đọc nghĩa → Gõ từ tương ứng vào ô trống', '📌 Task: Read the meaning → Type the matching word in the blank')}
                  </p>
                  {clozeSentence ? (
                    <>
                      <p className="mb-1.5 text-xs font-medium text-slate-500">{localText('Câu ví dụ chứa từ mới (______ = chỗ cần điền):', 'Example sentence with the new word (______ = fill in):')}</p>
                      <p className="text-base text-slate-800" lang={wordLanguageCode === 'zh' ? 'zh-CN' : wordLanguageCode === 'ja' ? 'ja' : wordLanguageCode === 'ko' ? 'ko' : undefined}>
                        {clozeSentence}
                      </p>
                      <p className="mt-2 mb-1 text-xs font-medium text-slate-500">{localText('Nghĩa của từ cần điền:', 'Meaning of the word to fill:')}</p>
                      <p className="text-slate-700">{displayMeaning}</p>
                    </>
                  ) : (
                    <>
                      <p className="mb-1.5 text-xs font-medium text-slate-500">{localText('Nghĩa:', 'Meaning:')}</p>
                      <p className="text-slate-700">{displayMeaning}</p>
                    </>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {clozeSentence
                      ? localText('Điền từ vào chỗ trống:', 'Fill in the blank:')
                      : localText('Gõ từ tương ứng với nghĩa trên:', 'Type the word matching the meaning above:')}
                  </label>
                  <Input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    lang={wordLanguageCode === 'zh' ? 'zh-CN' : wordLanguageCode === 'ja' ? 'ja' : wordLanguageCode === 'ko' ? 'ko' : undefined}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onCompositionStart={() => { isComposingRef.current = true }}
                    onCompositionEnd={(e) => {
                      isComposingRef.current = false
                      onInputChange((e.target as HTMLInputElement).value)
                      setCompositionEndAt(Date.now())
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleClozeSubmit()}
                    placeholder={
                      clozeSentence
                        ? localText('Gõ từ cần điền...', 'Type the word to fill...')
                        : localText('Gõ từ...', 'Type the word...')
                    }
                    className={cn(
                      'h-11 text-base',
                      inputCheckStatus === 'correct' && 'border-emerald-500 bg-emerald-50 focus-visible:ring-emerald-500',
                      inputCheckStatus === 'partial' && 'border-sky-300 bg-sky-50 focus-visible:ring-sky-400',
                      inputCheckStatus === 'incorrect' && 'border-rose-500 bg-rose-50 focus-visible:ring-rose-500'
                    )}
                    autoFocus
                  />
                  {inputCheckStatus === 'incorrect' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setWrongHint({ word: targetWord, meaning: correctMeaning, pronunciation: currentWord.pronunciation, type: 'cloze' })}
                      className="mt-2"
                    >
                      {localText('Xem gợi ý', 'Show hint')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {ex1 && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-700">
                    {localText('📌 Nhiệm vụ: Nghe từ → Gõ lại từ bạn nghe được', '📌 Task: Listen to the word → Type what you heard')}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => onPlayWord(currentWord.word, currentWord.pronunciationAudioUrl, currentWord)}
                    className="flex-1 min-h-[52px] text-base active:scale-[0.98] transition-transform"
                  >
                    <Volume2 className="mr-2 h-5 w-5" /> {localText('🔊 Bấm để nghe từ', '🔊 Tap to hear the word')}
                  </Button>
                  {onRegenerateWordAudio && currentWord ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRegenerateWordAudio(currentWord.word, currentWord)}
                      title={localText('Phát âm sai? Tạo lại bằng TTS', 'Wrong pronunciation? Regenerate with TTS')}
                      className="sm:self-center shrink-0 text-amber-700 border-amber-300 hover:bg-amber-50"
                    >
                      {localText('Phát âm sai? Tạo lại', 'Wrong? Regenerate')}
                    </Button>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {localText('Gõ từ bạn nghe được:', 'Type the word you heard:')}
                  </label>
                  <Input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    lang={wordLanguageCode === 'zh' ? 'zh-CN' : wordLanguageCode === 'ja' ? 'ja' : wordLanguageCode === 'ko' ? 'ko' : undefined}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onCompositionStart={() => { isComposingRef.current = true }}
                    onCompositionEnd={(e) => {
                      isComposingRef.current = false
                      onInputChange((e.target as HTMLInputElement).value)
                      setCompositionEndAt(Date.now())
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleListenSubmit()}
                    placeholder={localText('Gõ từ...', 'Type the word...')}
                    className={cn(
                      'h-11 text-base',
                      inputCheckStatus === 'correct' && 'border-emerald-500 bg-emerald-50 focus-visible:ring-emerald-500',
                      inputCheckStatus === 'partial' && 'border-sky-300 bg-sky-50 focus-visible:ring-sky-400',
                      inputCheckStatus === 'incorrect' && 'border-rose-500 bg-rose-50 focus-visible:ring-rose-500'
                    )}
                    autoFocus
                  />
                  {inputCheckStatus === 'incorrect' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setWrongHint({ word: targetWord, meaning: correctMeaning, pronunciation: currentWord.pronunciation, type: 'listen' })}
                      className="mt-2"
                    >
                      {localText('Xem gợi ý', 'Show hint')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {ex2 && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-2 font-medium text-slate-700">
                    {localText('📌 Nhiệm vụ: Chọn đáp án đúng (từ ↔ nghĩa)', '📌 Task: Choose the correct answer (word ↔ meaning)')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={recallDirection === 'word' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onRecallDirectionChange('word')}
                    >
                      {localText('Từ → Nghĩa', 'Word → Meaning')}
                    </Button>
                    <Button
                      type="button"
                      variant={recallDirection === 'meaning' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onRecallDirectionChange('meaning')}
                    >
                      {localText('Nghĩa → Từ', 'Meaning → Word')}
                    </Button>
                  </div>
                </div>
                {recallDirection === 'word' ? (
                  <>
                    <p className="text-sm font-medium text-slate-600">{localText('Từ:', 'Word:')}</p>
                    <p className="mb-3 text-xl font-semibold text-slate-900">{currentWord.word.charAt(0).toUpperCase() + currentWord.word.slice(1)}</p>
                    <p className="mb-2 text-sm font-medium text-slate-700">{localText('Chọn nghĩa đúng:', 'Choose the correct meaning:')}</p>
                    <div className="flex flex-wrap gap-2">
                      {meaningOptions.map((m) => (
                        <Button
                          key={m}
                          type="button"
                          variant="outline"
                          className="h-auto min-h-[40px] max-w-full whitespace-normal break-words text-left leading-snug"
                          onClick={() => {
                            if (m === correctMeaning) onRecallSubmit(currentWord.word, true)
                            else setWrongHint({ word: currentWord.word, meaning: correctMeaning, pronunciation: currentWord.pronunciation, type: 'recall' })
                          }}
                        >
                          {formatDisplayMeaning(m, currentWord.word, 80)}
                        </Button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-600">{localText('Nghĩa:', 'Meaning:')}</p>
                    <p className="mb-3 text-base text-slate-800">{displayMeaning}</p>
                    <p className="mb-2 text-sm font-medium text-slate-700">{localText('Chọn từ đúng:', 'Choose the correct word:')}</p>
                    <div className="flex flex-wrap gap-2">
                      {wordOptions.map((opt) => (
                        <Button
                          key={opt}
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (normalizeWordForCompare(opt) === normalizeWordForCompare(currentWord.word)) {
                              onRecallSubmit(currentWord.word, true)
                            } else {
                              setWrongHint({ word: currentWord.word, meaning: correctMeaning, pronunciation: currentWord.pronunciation, type: 'recall' })
                            }
                          }}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
