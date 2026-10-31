'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { appendWeddingComposeSuggestion } from '@/lib/wedding/wedding-sample-compose'

const SUGGESTION_KEYS = [
  ['sampleComposeSuggestMet', 'sampleComposeLineMet'],
  ['sampleComposeSuggestPlace', 'sampleComposeLinePlace'],
  ['sampleComposeSuggestMemory', 'sampleComposeLineMemory'],
  ['sampleComposeSuggestWeddingDay', 'sampleComposeLineWeddingDay'],
  ['sampleComposeSuggestNote', 'sampleComposeLineNote'],
] as const

export function WeddingSampleComposeModal(props: {
  locale: WebLocale
  open: boolean
  wedding: boolean
  busy: boolean
  groomLabel: string
  brideLabel: string
  groomName: string
  brideName: string
  storyNotes: string
  nameError: boolean
  onGroomName: (value: string) => void
  onBrideName: (value: string) => void
  onStoryNotes: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const tx = getDictionary(props.locale).weddingCardAiImage
  const storyLabel = props.wedding ? tx.sampleComposeStory : tx.sampleComposeNotes
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open && !props.busy) props.onCancel()
      }}
    >
      <DialogContent
        overlayClassName="z-[260]"
        showCloseButton={!props.busy}
        className="z-[260] max-h-[90dvh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{tx.sampleComposeTitle}</DialogTitle>
          <DialogDescription>{tx.sampleComposeHint}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wedding-compose-groom">
                {props.groomLabel} <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="wedding-compose-groom"
                value={props.groomName}
                disabled={props.busy}
                autoComplete="name"
                onChange={(event) => props.onGroomName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wedding-compose-bride">
                {props.brideLabel}
                {props.wedding ? <span className="text-rose-600"> *</span> : null}
              </Label>
              <Input
                id="wedding-compose-bride"
                value={props.brideName}
                disabled={props.busy}
                autoComplete="name"
                onChange={(event) => props.onBrideName(event.target.value)}
              />
            </div>
          </div>
          {props.nameError ? <p className="text-sm text-rose-700">{tx.sampleComposeNeedNames}</p> : null}
          <div className="space-y-1.5">
            <Label htmlFor="wedding-compose-story">{storyLabel}</Label>
            <Textarea
              id="wedding-compose-story"
              value={props.storyNotes}
              disabled={props.busy}
              placeholder={props.wedding ? tx.sampleComposeStoryPlaceholder : tx.sampleComposeNotesPlaceholder}
              className="min-h-28"
              onChange={(event) => props.onStoryNotes(event.target.value)}
            />
          </div>
          {props.wedding ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{tx.sampleComposeSuggestions}</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTION_KEYS.map(([labelKey, lineKey]) => (
                  <button
                    key={labelKey}
                    type="button"
                    disabled={props.busy}
                    className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-900 disabled:opacity-50"
                    onClick={() => props.onStoryNotes(appendWeddingComposeSuggestion(props.storyNotes, tx[lineKey]))}
                  >
                    {tx[labelKey]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" disabled={props.busy} onClick={props.onCancel}>
              {tx.sampleComposeCancel}
            </Button>
            <Button type="button" className="flex-[1.4]" disabled={props.busy} onClick={props.onConfirm}>
              {props.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {props.busy ? tx.sampleComposeWorking : tx.sampleComposeOk}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
