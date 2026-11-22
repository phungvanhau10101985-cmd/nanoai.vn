'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { fillAnswerCardText } from '@/lib/lop/answer-card'
import { downloadAnswerCardsDocx, downloadAnswerCardsPdf, type AnswerCardExportItem } from '@/lib/lop/answer-card-export'

type ExportContextValue = {
  className: string
  schoolName: string
  t: Dictionary['classes']
  exporting: string
  error: string
  selected: ReadonlySet<string>
  selectedCount: number
  toggle: (token: string) => void
  run: (key: string, task: () => Promise<void>) => Promise<void>
}

const ExportContext = createContext<ExportContextValue | null>(null)

function useExportContext() {
  const value = useContext(ExportContext)
  if (!value) throw new Error('Answer card export is outside its list')
  return value
}

export function AnswerCardExportProvider({
  className,
  schoolName = '',
  t,
  children,
}: {
  className: string
  schoolName?: string
  t: Dictionary['classes']
  children: ReactNode
}) {
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  function toggle(token: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(token)) next.delete(token)
      else next.add(token)
      return next
    })
  }

  async function run(key: string, task: () => Promise<void>) {
    if (exporting) return
    setExporting(key)
    setError('')
    try {
      await task()
    } catch {
      setError(t.answerCardsExportFailed)
    } finally {
      setExporting('')
    }
  }

  return (
    <ExportContext.Provider value={{ className, schoolName, t, exporting, error, selected, selectedCount: selected.size, toggle, run }}>
      {children}
    </ExportContext.Provider>
  )
}

export function AnswerCardExportError() {
  const { error } = useExportContext()
  if (!error) return null
  return <p className="text-sm text-destructive">{error}</p>
}

function cardsToExport(cards: AnswerCardExportItem[], selected: ReadonlySet<string>) {
  const chosen = cards.filter((card) => selected.has(card.token))
  return chosen.length > 0 ? chosen : cards
}

export function AnswerCardExportHint() {
  const { t, selectedCount } = useExportContext()
  const text =
    selectedCount > 0
      ? fillAnswerCardText(t.answerCardsExportSelectedHint, { n: selectedCount })
      : t.answerCardsExportAllHint
  return <p className="text-sm text-muted-foreground">{text}</p>
}

export function AnswerCardSelectBox({ token, name }: { token: string; name: string }) {
  const { selected, toggle, exporting, t } = useExportContext()
  return (
    <Checkbox
      checked={selected.has(token)}
      disabled={exporting !== ''}
      onCheckedChange={() => toggle(token)}
      aria-label={fillAnswerCardText(t.answerCardsSelectStudent, { name })}
    />
  )
}

function placeLinesFor(className: string, schoolName: string, t: Dictionary['classes']) {
  return [className.trim() ? `${t.answerCardClassLabel} ${className.trim()}` : '', schoolName.trim() ? `${t.schoolLabel} ${schoolName.trim()}` : ''].filter(Boolean)
}

export function AnswerCardClassFileButtons({ cards }: { cards: AnswerCardExportItem[] }) {
  const { className, schoolName, t, exporting, selected, run } = useExportContext()
  const disabled = cards.length === 0 || exporting !== ''
  const exportCards = () => cardsToExport(cards, selected)
  const places = placeLinesFor(className, schoolName, t)
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => void run('docx', () => downloadAnswerCardsDocx(className, exportCards(), t.answerCardFoldHint, places))}
      >
        {exporting === 'docx' ? t.answerCardsExporting : t.answerCardsDownloadDocx}
      </Button>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => void run('pdf', () => downloadAnswerCardsPdf(className, exportCards(), t.answerCardFoldHint, places))}
      >
        {exporting === 'pdf' ? t.answerCardsExporting : t.answerCardsDownloadPdf}
      </Button>
    </div>
  )
}

export function AnswerCardStudentButton({ card }: { card: AnswerCardExportItem }) {
  const { className, schoolName, t, exporting, run } = useExportContext()
  const places = placeLinesFor(className, schoolName, t)
  const key = `card-${card.cardNo}`
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 shrink-0"
      disabled={exporting !== ''}
      onClick={() => void run(key, () => downloadAnswerCardsPdf(className, [card], t.answerCardFoldHint, places))}
    >
      <QrCode className="mr-1 h-3.5 w-3.5" aria-hidden />
      {exporting === key ? t.answerCardsExporting : t.answerCardsOneQr}
    </Button>
  )
}
