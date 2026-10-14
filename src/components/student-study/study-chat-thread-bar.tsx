'use client'

import { History, MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  newLabel: string
  historyLabel: string
  historyOpen: boolean
  disabled: boolean
  onNew: () => void
  onHistory: () => void
}

export function StudyChatThreadBar({
  newLabel,
  historyLabel,
  historyOpen,
  disabled,
  onNew,
  onHistory,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-t bg-muted/40 px-3 pt-2">
      <Button
        type="button"
        className="h-11 gap-1.5 px-3 text-sm md:h-9"
        disabled={disabled}
        aria-label={newLabel}
        title={newLabel}
        onClick={onNew}
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" aria-hidden />
        <span>{newLabel}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-1.5 bg-background px-3 text-sm md:h-9"
        disabled={disabled}
        aria-expanded={historyOpen}
        aria-haspopup="dialog"
        aria-label={historyLabel}
        title={historyLabel}
        onClick={onHistory}
      >
        <History className="h-4 w-4 shrink-0" aria-hidden />
        <span>{historyLabel}</span>
      </Button>
    </div>
  )
}
