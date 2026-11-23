'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HomeworkProblemCard } from '@/components/student-study/homework-problem-card'
import { StudentStudyPaywall } from '@/components/student-study/student-study-paywall'
import { useWebLocaleFromDocumentCookie } from '@/hooks/use-web-locale-from-cookie'
import { consultExerciseQuestion } from '@/app/ho-tro-lam-bai/actions'
import { homeworkHelpCopy } from '@/lib/homework-help/homework-help-copy'
import type { HomeworkProblem } from '@/lib/homework-help/homework-help-guide'

export function HomeworkConsultButton({
  examCode,
  questionId,
  label,
  title,
  openingLabel,
  failedLabel,
}: {
  examCode: string
  questionId: string
  label: string
  title: string
  openingLabel: string
  failedLabel: string
}) {
  const locale = useWebLocaleFromDocumentCookie()
  const copy = homeworkHelpCopy(locale)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [needsPlan, setNeedsPlan] = useState(false)
  const [problem, setProblem] = useState<HomeworkProblem | null>(null)
  const [paid, setPaid] = useState(false)

  async function load() {
    if (problem || loading) return
    setLoading(true)
    setFailed(false)
    setNeedsPlan(false)
    try {
      const result = await consultExerciseQuestion({ locale, examCode, questionId })
      if (!result.ok) {
        if (result.code === 'payment_required') setNeedsPlan(true)
        else setFailed(true)
        return
      }
      setProblem(result.data)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => {
          setOpen(true)
          void load()
        }}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(40rem,90dvh)] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {needsPlan ? (
              <StudentStudyPaywall
                locale={locale}
                onPurchased={() => {
                  setNeedsPlan(false)
                  setProblem(null)
                  void load()
                }}
              />
            ) : null}
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {openingLabel}
              </p>
            ) : null}
            {failed ? <p className="text-sm text-destructive">{failedLabel}</p> : null}
            {problem ? (
              <HomeworkProblemCard
                locale={locale}
                copy={copy}
                problem={problem}
                solutionPaid={paid}
                onSolutionPaid={() => setPaid(true)}
                onPaymentRequired={() => setNeedsPlan(true)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
