'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { parseWorksheetMarkdown } from '@/lib/parse-worksheet-markdown'
import { submitWorksheet } from './actions'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Worksheet = { id: string; topic: string; content_markdown: string }

function markdownToHtml(md: string): string {
  const lines = md.split(/\n/)
  const out: string[] = []
  for (const line of lines) {
    if (/^### (.+)$/.test(line)) {
      out.push(`<h3 class="text-base font-semibold mt-4 mb-2">${line.replace(/^### (.+)$/, '$1')}</h3>`)
    } else if (/^## (.+)$/.test(line)) {
      out.push(`<h2 class="text-lg font-semibold mt-6 mb-2">${line.replace(/^## (.+)$/, '$1')}</h2>`)
    } else if (line.trim()) {
      const formatted = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
      out.push(`<p class="my-1">${formatted}</p>`)
    } else {
      out.push('<br/>')
    }
  }
  return `<div class="space-y-1">${out.join('')}</div>`
}

export default function LamBaiClient({
  worksheet,
  classId,
  t,
}: {
  worksheet: Worksheet
  classId: string
  t: Dictionary['classes']
}) {
  const parsed = useMemo(() => parseWorksheetMarkdown(worksheet.content_markdown), [worksheet.content_markdown])
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const canSubmit = parsed.quiz.length > 0 || parsed.essay.length > 0

  const quizScore = parsed.quiz.reduce((acc, q) => {
    const ans = quizAnswers[q.index]
    return acc + (typeof ans === 'number' && ans === q.correctIndex ? 1 : 0)
  }, 0)
  const quizTotal = parsed.quiz.length

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    const quizObj: Record<string, number> = {}
    for (const [k, v] of Object.entries(quizAnswers)) {
      if (typeof v === 'number') quizObj[String(k)] = v
    }
    const essayObj: Record<string, string> = {}
    for (const [k, v] of Object.entries(essayAnswers)) {
      if (typeof v === 'string' && v.trim()) essayObj[String(k)] = v.trim()
    }
    const res = await submitWorksheet(
      worksheet.id,
      classId,
      { quiz: quizObj, essay: essayObj },
      quizScore,
      quizTotal
    )
    setSubmitting(false)
    if (res.error) {
      toast({ variant: 'destructive', description: res.error })
      return
    }
    setSubmitted(true)
    toast({ description: t.submitSuccess })
    router.push(`/phieu-bai-tap/${worksheet.id}/ket-qua?classId=${classId}`)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Toaster />
      <header className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{worksheet.topic}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.doWorksheet}</p>
      </header>

      <div className="space-y-8">
        {parsed.quiz.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">{t.worksheetLamBaiMcqSectionTitle}</h2>
            <div className="space-y-4">
              {parsed.quiz.map((q) => (
                <div key={q.index} className="rounded-lg border border-input p-4">
                  <p className="text-sm font-medium mb-3" dangerouslySetInnerHTML={{ __html: markdownToHtml(latexToReadable(q.question)) }} />
                  <div className="space-y-2">
                    {q.options.map((opt, i) => (
                      <label key={i} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`quiz-${q.index}`}
                          checked={quizAnswers[q.index] === i}
                          onChange={() => setQuizAnswers((prev) => ({ ...prev, [q.index]: i }))}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          {String.fromCharCode(65 + i)}. <span dangerouslySetInnerHTML={{ __html: markdownToHtml(latexToReadable(opt)) }} />
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {parsed.essay.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">{t.worksheetLamBaiEssaySectionTitle}</h2>
            <div className="space-y-4">
              {parsed.essay.map((e) => (
                <div key={e.index} className="rounded-lg border border-input p-4">
                  <p className="text-sm font-medium mb-2" dangerouslySetInnerHTML={{ __html: markdownToHtml(latexToReadable(e.prompt)) }} />
                  <textarea
                    value={essayAnswers[e.index] ?? ''}
                    onChange={(ev) => setEssayAnswers((prev) => ({ ...prev, [e.index]: ev.target.value }))}
                    placeholder={t.worksheetLamBaiEssayPlaceholder}
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {parsed.quiz.length === 0 && parsed.essay.length === 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-foreground leading-relaxed">
            {t.worksheetLamBaiNoInteractiveHint}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting || submitted}>
          {submitting ? '...' : t.submit}
        </Button>
        <Button variant="ghost" size="sm" className="h-auto px-2 text-muted-foreground hover:text-foreground" asChild>
          <Link href={`/lop/${classId}/phieu-bai-tap`}>{t.worksheetLamBaiBackToClassWorksheets}</Link>
        </Button>
      </div>
    </div>
  )
}
