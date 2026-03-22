'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { assignWorksheetToClass, removeWorksheetFromClass } from '@/app/lop/actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Check, Plus } from 'lucide-react'

type Worksheet = { id: string; topic: string }

export default function GanPhieuClient({
  classId,
  assignedIds,
  worksheets,
  t,
}: {
  classId: string
  assignedIds: string[]
  worksheets: Worksheet[]
  t: Dictionary['classes']
}) {
  const [assigned, setAssigned] = useState<Set<string>>(new Set(assignedIds))
  const [loading, setLoading] = useState<string | null>(null)
  const { toast } = useToast()

  async function toggle(worksheetId: string) {
    if (loading) return
    const isAssigned = assigned.has(worksheetId)
    setLoading(worksheetId)
    const res = isAssigned
      ? await removeWorksheetFromClass(classId, worksheetId)
      : await assignWorksheetToClass(classId, worksheetId)
    setLoading(null)
    if (res.error) {
      toast({ variant: 'destructive', description: res.error })
      return
    }
    setAssigned((prev) => {
      const next = new Set(prev)
      if (isAssigned) next.delete(worksheetId)
      else next.add(worksheetId)
      return next
    })
    toast({ description: isAssigned ? 'Đã bỏ gán' : 'Đã gán phiếu' })
  }

  if (worksheets.length === 0) {
    return (
      <>
        <Toaster />
        <p className="text-sm text-muted-foreground">{t.noWorksheets}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Tạo phiếu bài tập tại{' '}
          <a href="/giao-trinh" className="text-primary hover:underline">
            Tạo giáo trình
          </a>
        </p>
      </>
    )
  }

  return (
    <>
      <Toaster />
      <ul className="space-y-2">
        {worksheets.map((w) => {
          const isAssigned = assigned.has(w.id)
          return (
            <li
              key={w.id}
              className="flex items-center justify-between rounded-lg border border-input bg-card px-4 py-3"
            >
              <span className="text-sm font-medium">{w.topic}</span>
              <Button
                variant={isAssigned ? 'secondary' : 'default'}
                size="sm"
                onClick={() => toggle(w.id)}
                disabled={loading === w.id}
              >
                {loading === w.id ? '...' : isAssigned ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </Button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
