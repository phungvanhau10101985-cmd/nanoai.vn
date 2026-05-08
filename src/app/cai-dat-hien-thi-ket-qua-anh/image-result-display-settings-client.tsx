'use client'

import { useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  type BeforeAfterViewMode,
  readBeforeAfterViewMode,
  writeBeforeAfterViewMode,
} from '@/lib/image-tools/before-after-view-preference'

type Props = { copy: Dictionary['imageResultDisplay'] }

export function ImageResultDisplaySettingsClient({ copy }: Props) {
  const [mode, setModeState] = useState<BeforeAfterViewMode>('split')

  useEffect(() => {
    setModeState(readBeforeAfterViewMode())
  }, [])

  const selectMode = (m: BeforeAfterViewMode) => {
    writeBeforeAfterViewMode(m)
    setModeState(m)
  }

  return (
    <Card className="border shadow-sm bg-white/80 backdrop-blur max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{copy.pageTitle}</CardTitle>
        <CardDescription>{copy.pageIntro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          className={cn(
            'w-full rounded-xl border p-4 text-left transition-colors',
            mode === 'split' ? 'border-primary bg-primary/[0.06] ring-2 ring-primary/30' : 'border-border hover:bg-muted/50'
          )}
          onClick={() => selectMode('split')}
        >
          <p className="font-medium">{copy.modeSplitTitle}</p>
          <p className="text-sm text-muted-foreground mt-1">{copy.modeSplitDesc}</p>
        </button>
        <button
          type="button"
          className={cn(
            'w-full rounded-xl border p-4 text-left transition-colors',
            mode === 'compare' ? 'border-primary bg-primary/[0.06] ring-2 ring-primary/30' : 'border-border hover:bg-muted/50'
          )}
          onClick={() => selectMode('compare')}
        >
          <p className="font-medium">{copy.modeCompareTitle}</p>
          <p className="text-sm text-muted-foreground mt-1">{copy.modeCompareDesc}</p>
        </button>
        <p className="text-xs text-muted-foreground">{copy.persistNote}</p>
      </CardContent>
    </Card>
  )
}
