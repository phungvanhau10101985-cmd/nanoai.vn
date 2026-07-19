'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function HubPackagingFaceUploadConfirmDialog({
  open,
  onOpenChange,
  previewUrl,
  fileName,
  faceLabel,
  sizeLabel,
  busy,
  labels,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewUrl: string | null
  fileName: string
  faceLabel: string
  sizeLabel: string
  busy: boolean
  labels: {
    title: string
    faceField: string
    sizeField: string
    fileField: string
    hint: string
    confirm: string
    cancel: string
  }
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{labels.title}</DialogTitle>
        </DialogHeader>

        <dl className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels.faceField}
            </dt>
            <dd className="mt-1 text-base font-semibold text-amber-950 dark:text-amber-50">{faceLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels.sizeField}
            </dt>
            <dd className="mt-1 text-base font-semibold text-amber-950 dark:text-amber-50">{sizeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels.fileField}
            </dt>
            <dd className="mt-1 break-all text-sm text-foreground">{fileName}</dd>
          </div>
        </dl>

        {previewUrl ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
            <Image
              src={previewUrl}
              alt={fileName}
              width={480}
              height={320}
              unoptimized
              className="mx-auto max-h-52 w-auto object-contain"
            />
          </div>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">{labels.hint}</p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
