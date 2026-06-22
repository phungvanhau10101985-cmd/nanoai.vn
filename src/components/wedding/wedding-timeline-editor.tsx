'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  parseWeddingEventTimeline,
  serializeWeddingEventTimeline,
  type WeddingTimelineItem,
} from '@/lib/wedding/wedding-event-timeline'

type WeddingTimelineEditorProps = {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  className?: string
}

function emptyRow(): WeddingTimelineItem {
  return { time: '', title: '', note: '' }
}

function timelineRowContent(row: WeddingTimelineItem): string {
  if (row.note) return row.title ? `${row.title} - ${row.note}` : row.note
  return row.title
}

function normalizeRows(rows: WeddingTimelineItem[]): WeddingTimelineItem[] {
  return rows.length > 0 ? rows : [emptyRow()]
}

export function WeddingTimelineEditor({ label, value, onChange, hint, className }: WeddingTimelineEditorProps) {
  const lastEmittedRef = useRef(value)
  const [rows, setRows] = useState(() => normalizeRows(parseWeddingEventTimeline(value)))

  useEffect(() => {
    if (value === lastEmittedRef.current) return
    lastEmittedRef.current = value
    setRows(normalizeRows(parseWeddingEventTimeline(value)))
  }, [value])

  const emitRows = (nextRows: WeddingTimelineItem[]) => {
    const normalized = normalizeRows(nextRows)
    setRows(normalized)
    const serialized = serializeWeddingEventTimeline(normalized)
    lastEmittedRef.current = serialized
    onChange(serialized)
  }

  const updateRow = (index: number, patch: Partial<WeddingTimelineItem>) => {
    emitRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  const updateRowContent = (index: number, content: string) => {
    updateRow(index, { title: content, note: '' })
  }

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()])
  }

  const removeRow = (index: number) => {
    emitRows(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="leading-snug">{label}</Label>
      <div className="space-y-2 rounded-2xl border p-3">
        {rows.map((row, index) => (
          <div key={`timeline-row-${index}`} className="flex items-center gap-2">
            <Input
              type="time"
              value={row.time}
              onChange={(event) => updateRow(index, { time: event.target.value })}
              className="w-[7.25rem] shrink-0 tabular-nums"
              aria-label={`Giờ mốc ${index + 1}`}
            />
            <Input
              value={timelineRowContent(row)}
              onChange={(event) => updateRowContent(index, event.target.value)}
              placeholder="Nội dung (vd: Đón khách - Chụp ảnh lưu niệm)"
              className="min-w-0 flex-1"
              aria-label={`Nội dung mốc ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(index)}
              disabled={rows.length === 1 && !row.time && !row.title && !row.note}
              title="Xóa mốc"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRow}>
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm mốc lịch trình
        </Button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
