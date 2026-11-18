'use client'

import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function HubImagePromptPolishButton({
  label,
  title,
  busy,
  disabled,
  onClick,
}: {
  label: string
  title?: string
  busy?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      title={title}
      className="h-7 gap-1 border-violet-300 bg-white/95 px-2 text-xs text-violet-800 hover:bg-violet-50 dark:border-violet-700 dark:bg-slate-900/90 dark:text-violet-200"
      disabled={disabled || busy}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {label}
    </Button>
  )
}
