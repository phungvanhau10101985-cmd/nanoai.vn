'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { confirmAdminCreditDepositAction } from './actions'

export function ConfirmCreditDepositButton({
  paymentId,
  labels,
}: {
  paymentId: string
  labels: {
    confirm: string
    confirmAgain: string
    cancel: string
    title: string
    body: string
    success: string
    errorTitle: string
  }
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()

  const submit = () => {
    startTransition(async () => {
      const result = await confirmAdminCreditDepositAction(paymentId)
      if ('error' in result) {
        toast({ title: labels.errorTitle, description: result.error, variant: 'destructive' })
        setOpen(false)
        router.refresh()
        return
      }
      toast({ title: labels.success })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button type="button" size="sm" className="h-7" onClick={() => setOpen(true)}>
        {labels.confirm}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              {labels.confirmAgain}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
