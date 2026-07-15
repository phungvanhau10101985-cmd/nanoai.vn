'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useStepUpOtp } from '@/components/auth/step-up-otp-provider'
import { isStepUpRequiredError } from '@/lib/auth/step-up-otp'
import { deleteCompletedLessonWithStepUp } from './actions'

export function DeleteCompletedLessonButton({
  lessonId,
  label,
  confirmMessage,
}: {
  lessonId: string
  label: string
  confirmMessage: string
}) {
  const { toast } = useToast()
  const { runWithStepUp } = useStepUpOtp()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  const handleDelete = () => {
    if (!window.confirm(confirmMessage)) return
    startTransition(async () => {
      setBusy(true)
      const result = await runWithStepUp(() => deleteCompletedLessonWithStepUp(lessonId))
      setBusy(false)
      if ('error' in result) {
        if (!isStepUpRequiredError(result)) {
          toast({ title: result.error, variant: 'destructive' })
        }
        return
      }
      toast({ title: 'OK' })
    })
  }

  return (
    <Button type="button" size="sm" variant="destructive" onClick={handleDelete} disabled={pending || busy}>
      {label}
    </Button>
  )
}
