'use client'

import { useMemo, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { parseWorksheetMarkdown } from '@/lib/parse-worksheet-markdown'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import WorksheetView from '../worksheet-view'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Worksheet = { id: string; topic: string; content_markdown: string }
type Submission = {
  quiz_score: number
  quiz_total: number
  answers_json: { quiz?: Record<string, number>; essay?: Record<string, string> }
}

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

export default function KetQuaClient({
  worksheet,
  submission,
  t,
  questionBadge,
}: {
  worksheet: Worksheet
  submission: Submission
  t: Dictionary['classes']
  questionBadge: string
}) {
  const router = useRouter()
  const parsed = useMemo(() => parseWorksheetMarkdown(worksheet.content_markdown), [worksheet.content_markdown])
  const quizAnswers = submission.answers_json?.quiz ?? {}
  const essayAnswers = submission.answers_json?.essay ?? {}
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" id="worksheet-result-top">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{worksheet.topic}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t.quizScore}: {submission.quiz_score}/{submission.quiz_total}
        </p>
      </header>

      <div className="space-y-8">
        {parsed.quiz.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Trắc nghiệm – Đáp án của bạn</h2>
            <div className="space-y-4">
              {parsed.quiz.map((q) => {
                const userAns = quizAnswers[String(q.index)]
                const isCorrect = typeof userAns === 'number' && userAns === q.correctIndex
                return (
                  <div key={q.index} className={`rounded-lg border p-4 ${isCorrect ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <p className="text-sm font-medium mb-2" dangerouslySetInnerHTML={{ __html: markdownToHtml(latexToReadable(q.question)) }} />
                    <p className="text-sm">
                      Bạn chọn: <strong>{typeof userAns === 'number' ? String.fromCharCode(65 + userAns) : '—'}</strong>
                      {!isCorrect && (
                        <span className="ml-2 text-green-600 dark:text-green-400">
                          Đáp án đúng: {String.fromCharCode(65 + q.correctIndex)}
                        </span>
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {parsed.essay.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Tự luận</h2>
            <div className="space-y-4">
              {parsed.essay.map((e) => (
                <div key={e.index} className="rounded-lg border border-input p-4">
                  <p className="text-sm font-medium mb-2" dangerouslySetInnerHTML={{ __html: markdownToHtml(latexToReadable(e.prompt)) }} />
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">Bài làm của bạn:</p>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">{essayAnswers[String(e.index)] ?? '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {parsed.answerSection && (
          <section>
            <h2 className="text-lg font-semibold mb-4">{t.sampleAnswer}</h2>
            <WorksheetView content={parsed.answerSection} questionBadge={questionBadge} />
          </section>
        )}
      </div>

      <div className="mt-8">
        <button type="button" className="text-sm text-primary hover:underline" onClick={() => router.back()}>
          ← Về lớp
        </button>
      </div>
    </div>
  )
}
