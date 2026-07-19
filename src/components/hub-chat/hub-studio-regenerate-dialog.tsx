'use client'

import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { HubStudioGenerationRefPicker } from '@/components/hub-chat/hub-studio-generation-ref-picker'
import { STUDIO_REFERENCE_ATTACH_LIMIT } from '@/lib/hub-chat/hub-studio-reference-limits'

type RefOption = { url: string; label: string; screenKey: string }
type ProductPreview = { url: string; label: string }

export type HubStudioRegenerateDialogLabels = {
  title: string
  promptLabel: string
  promptHint: string
  confirm: string
  cancel: string
  refPickerTitle: string
  refPickerHint: string
  refApprovedSection: string
  refProductSection: string
  refProductLabel: string
  refStyleSection?: string
  refStyleLabel?: string
  refStyleUploadNote?: string
  refStyleRemove?: string
  refAttachCount: string
  refRemoveProduct: string
}

export function HubStudioRegenerateDialog({
  open,
  onOpenChange,
  screenLabel,
  prompt,
  onPromptChange,
  showRefPicker,
  refOptions,
  selectedRefKeys,
  productPreviews,
  attachUsed,
  attachLimit = STUDIO_REFERENCE_ATTACH_LIMIT,
  busy,
  labels,
  onToggleRef,
  onUploadProduct,
  onRemoveProduct,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  screenLabel?: string
  prompt: string
  onPromptChange: (value: string) => void
  showRefPicker: boolean
  refOptions: RefOption[]
  selectedRefKeys: string[]
  productPreviews: ProductPreview[]
  attachUsed?: number
  attachLimit?: number
  busy: boolean
  labels: HubStudioRegenerateDialogLabels
  onToggleRef: (screenKey: string, checked: boolean) => void
  onUploadProduct: (files: FileList) => void
  onRemoveProduct: (url: string) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,720px)] max-w-lg flex-col gap-3 overflow-hidden p-4 sm:p-5">
        <DialogHeader className="shrink-0 space-y-1">
          <DialogTitle className="text-base">{labels.title}</DialogTitle>
          {screenLabel ? <p className="text-xs font-medium text-violet-800 dark:text-violet-200">{screenLabel}</p> : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
          <div>
            <label className="text-xs font-medium text-foreground">{labels.promptLabel}</label>
            <Textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={5}
              disabled={busy}
              className="mt-1.5 resize-y text-sm"
            />
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{labels.promptHint}</p>
          </div>

          {showRefPicker ? (
            <HubStudioGenerationRefPicker
              options={refOptions}
              selectedKeys={selectedRefKeys}
              productPreviews={productPreviews}
              attachUsed={attachUsed}
              attachLimit={attachLimit}
              busy={busy}
              labels={{
                title: labels.refPickerTitle,
                hint: labels.refPickerHint,
                approvedSection: labels.refApprovedSection,
                styleSection: labels.refStyleSection ?? '',
                styleUpload: labels.refStyleLabel ?? '',
                styleUploadNote: labels.refStyleUploadNote ?? '',
                removeStyle: labels.refStyleRemove ?? '',
                productSection: labels.refProductSection,
                productUpload: labels.refProductLabel,
                productUploadNote: '',
                attachCount: labels.refAttachCount,
                removeProduct: labels.refRemoveProduct,
              }}
              onToggleRef={onToggleRef}
              onUploadProduct={onUploadProduct}
              onRemoveProduct={onRemoveProduct}
            />
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            className="bg-violet-600 hover:bg-violet-700"
            disabled={busy || prompt.trim().length < 2}
            onClick={onConfirm}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
