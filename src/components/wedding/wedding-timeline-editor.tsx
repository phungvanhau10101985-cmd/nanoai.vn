'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { WeddingTimeField } from '@/components/wedding/wedding-time-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

const CONTENT_PLACEHOLDER = 'Nội dung (vd: Đón khách - Chụp ảnh lưu niệm)'

/** Ô nội dung mobile: hộp lớn trên vùng nhìn thấy, chữ đủ câu, bấm OK mới ghi. */
function TimelineContentMobileField(props: { value: string; onCommit: (value: string) => void; index: number }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(props.value)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const [viewport, setViewport] = useState({ top: 12, height: 640 })

  useEffect(() => {
    if (!open) return
    const viewportApi = window.visualViewport
    if (!viewportApi) return
    const sync = () => {
      setViewport({
        top: viewportApi.offsetTop + 8,
        height: Math.max(160, viewportApi.height - 16),
      })
    }
    sync()
    viewportApi.addEventListener('resize', sync)
    viewportApi.addEventListener('scroll', sync)
    return () => {
      viewportApi.removeEventListener('resize', sync)
      viewportApi.removeEventListener('scroll', sync)
    }
  }, [open])

  const openEditor = () => {
    const viewportApi = window.visualViewport
    if (viewportApi) {
      setViewport({
        top: viewportApi.offsetTop + 8,
        height: Math.max(160, viewportApi.height - 16),
      })
    }
    setDraft(props.value)
    setOpen(true)
  }

  const confirm = () => {
    props.onCommit(draft.trim())
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className={cn(
          'flex min-h-11 w-full items-center rounded-md border border-input bg-white px-3 py-2 text-left text-base leading-snug shadow-sm md:hidden',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          props.value ? 'text-slate-950' : 'text-slate-400',
        )}
        aria-label={`Nội dung mốc ${props.index + 1}`}
      >
        <span className="whitespace-pre-wrap break-words">{props.value || CONTENT_PLACEHOLDER}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="left-1/2 w-[calc(100vw-1.5rem)] max-w-lg translate-x-[-50%] translate-y-0 gap-3 overflow-y-auto bg-white p-4 text-slate-950"
          style={{ top: viewport.top, maxHeight: viewport.height }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            areaRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-slate-950">Nội dung lịch trình</DialogTitle>
            <DialogDescription className="text-slate-600">Gõ hết câu. Bấm OK để ghi vào mốc.</DialogDescription>
          </DialogHeader>
          <Textarea
            ref={areaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={CONTENT_PLACEHOLDER}
            rows={4}
            enterKeyHint="done"
            className="min-h-[5.5rem] resize-none bg-white text-base leading-relaxed text-slate-950 placeholder:text-slate-400"
            aria-label={`Soạn nội dung mốc ${props.index + 1}`}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                confirm()
              }
            }}
          />
          <Button type="button" className="h-11 w-full text-base" onClick={confirm}>
            OK
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
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
          <div key={`timeline-row-${index}`} className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex items-center gap-2 md:contents">
              <WeddingTimeField
                value={row.time}
                onChange={(time) => updateRow(index, { time })}
                className="w-[7.25rem] shrink-0"
                ariaLabel={`Giờ mốc ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive md:order-3 md:ml-0"
                onClick={() => removeRow(index)}
                disabled={rows.length === 1 && !row.time && !row.title && !row.note}
                title="Xóa mốc"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <TimelineContentMobileField
              value={timelineRowContent(row)}
              onCommit={(content) => updateRowContent(index, content)}
              index={index}
            />
            <Input
              value={timelineRowContent(row)}
              onChange={(event) => updateRowContent(index, event.target.value)}
              placeholder={CONTENT_PLACEHOLDER}
              className="hidden min-w-0 flex-1 bg-white text-slate-950 placeholder:text-slate-400 md:order-2 md:block"
              aria-label={`Nội dung mốc ${index + 1}`}
            />
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
