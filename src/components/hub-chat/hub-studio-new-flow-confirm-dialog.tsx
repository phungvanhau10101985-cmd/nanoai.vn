'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function HubStudioNewFlowConfirmDialog({
  open,
  currentTitle,
  targetTitle,
  busy,
  labels,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  currentTitle: string
  targetTitle: string
  busy: boolean
  labels: {
    title: string
    body: string
    confirm: string
    cancel: string
  }
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {labels.body
              .replace('{current}', currentTitle)
              .replace('{target}', targetTitle)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{labels.cancel}</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={() => void onConfirm()}>
            {labels.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
