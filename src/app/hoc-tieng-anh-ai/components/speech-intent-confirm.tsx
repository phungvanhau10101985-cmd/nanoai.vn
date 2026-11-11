'use client'

import { useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { ProcessingRow } from './processing-status'
import { LessonImeField } from '../ime/lesson-ime-field'
import { Button } from '@/components/ui/button'

type LocalText = (vi: string, en: string) => string

export function SpeechIntentConfirm({
  text,
  meaning,
  meaningBusy,
  continueBusy,
  onTextChange,
  onContinue,
  onReplay,
  localText,
  languageCode,
}: {
  text: string
  meaning: string
  meaningBusy: boolean
  continueBusy: boolean
  onTextChange: (value: string) => void
  onContinue: () => void
  onReplay?: () => void
  localText: LocalText
  languageCode: string
}) {
  const flushRef = useRef<(() => string) | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-emerald-800">
        {localText('Có phải em muốn nói', 'Is this what you meant')}
      </p>
      <LessonImeField
        value={text}
        onChange={onTextChange}
        languageCode={languageCode}
        localText={localText}
        flushRef={flushRef}
        onPendingChange={setPending}
        disabled={continueBusy}
        className="bg-white text-slate-900"
      />
      {meaningBusy ? (
        <ProcessingRow className="text-sm leading-relaxed text-slate-700">
          {localText('Đang dịch...', 'Translating...')}
        </ProcessingRow>
      ) : meaning ? (
        <p className="text-sm leading-relaxed text-slate-700">{meaning}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const flushed = (flushRef.current?.() ?? text).trim()
            if (flushed !== text.trim()) return
            onContinue()
          }}
          disabled={continueBusy || meaningBusy || (!text.trim() && !pending)}
          className="min-h-[40px] px-4"
        >
          {localText('Tiếp', 'Continue')}
        </Button>
        {onReplay ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onReplay}
            disabled={continueBusy}
            className="min-h-[40px] bg-white px-4"
          >
            <Volume2 className="mr-2 h-4 w-4" />
            {localText('Nghe lại', 'Play back')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
