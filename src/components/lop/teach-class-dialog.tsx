'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TeachClassOption } from '@/lib/db/class-taught-lessons-pg'

export function TeachClassDialog({
  open,
  loading,
  classes,
  labels,
  onPick,
  onSkip,
}: {
  open: boolean
  loading: boolean
  classes: TeachClassOption[]
  labels: {
    title: string
    lead: string
    loading: string
    skip: string
  }
  onPick: (classId: string) => void
  onSkip: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onSkip() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{labels.lead}</p>
        {loading ? <p className="text-sm text-muted-foreground">{labels.loading}</p> : null}
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {classes.map((row) => (
            <Button
              key={row.classId}
              type="button"
              variant="outline"
              className="h-auto w-full justify-start px-3 py-2 text-left"
              onClick={() => onPick(row.classId)}
              disabled={loading}
            >
              <span className="block">
                <span className="block font-semibold">{row.className}</span>
                <span className="block text-xs text-muted-foreground">
                  {[row.subjectLabel, row.schoolName].filter(Boolean).join(' · ')}
                </span>
              </span>
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" className="w-full" onClick={onSkip} disabled={loading}>
          {labels.skip}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
