'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
  DialogClose,
} from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EmbedType } from './content-embed'

export type EmbedPlacement = 'end' | 'newBlock' | number

interface EmbedInsertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type?: EmbedType | null
  onInsert: (marker: string, placement?: EmbedPlacement) => void
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  highZIndex?: boolean
  blocks?: Array<{ header: string; content?: string }>
}

const EMBED_OPTIONS: Array<{ value: EmbedType; label: string }> = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'geogebra', label: 'GeoGebra' },
  { value: 'desmos', label: 'Desmos' },
  { value: 'phet', label: 'PhET' },
  { value: 'maps', label: 'Google Maps' },
  { value: 'image', label: 'Hình ảnh' },
  { value: 'audio', label: 'Âm thanh' },
  { value: 'quiz', label: 'Trắc nghiệm' },
  { value: 'code', label: 'CodePen' },
  { value: 'latex', label: 'LaTeX' },
]

function buildMarker(type: EmbedType, value: string): string {
  const v = value.trim()
  if (!v) return ''
  if (type === 'quiz') return `[quiz:${v}]`
  if (type === 'latex') return `[latex:${v}]`
  return `[${type}:${v}]`
}

function canInsert(type: EmbedType, value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (type === 'youtube') return /(youtube\.com|youtu\.be)/.test(v) || v.length === 11
  if (type === 'geogebra') return v.includes('geogebra.org') || v.length < 30
  if (type === 'desmos') return v.includes('desmos.com') || v.length < 30
  if (type === 'phet') return v.includes('phet') && v.startsWith('http')
  if (type === 'maps') return (v.includes('google.com/maps') || v.includes('goo.gl')) && v.startsWith('http')
  if (type === 'image' || type === 'audio') return v.startsWith('http') || v.startsWith('data:')
  if (type === 'quiz') return v.split('|').length >= 3
  if (type === 'code') return v.includes('codepen.io') && v.startsWith('http')
  if (type === 'latex') return v.length > 0
  return false
}

const PLACEHOLDERS: Record<EmbedType, string> = {
  youtube: 'https://www.youtube.com/watch?v=xxxxx',
  geogebra: 'https://www.geogebra.org/calculator/xxxxx',
  desmos: 'https://www.desmos.com/calculator/xxxxx',
  phet: 'https://phet.colorado.edu/sims/html/...',
  maps: 'https://www.google.com/maps/embed?pb=...',
  image: 'https://example.com/image.png',
  audio: 'https://example.com/audio.mp3',
  quiz: 'Câu hỏi?|Đáp án A|Đáp án B|Đáp án C|0',
  code: 'https://codepen.io/user/pen/xxxxx',
  latex: 'x^2 + y^2 = r^2',
}

const DESCRIPTIONS: Record<EmbedType, string> = {
  youtube: 'Dán link YouTube',
  geogebra: 'Dán link GeoGebra (Share → Embed)',
  desmos: 'Dán link desmos.com/calculator',
  phet: 'Dán link mô phỏng PhET',
  maps: 'Dán link Google Maps (Share → Embed)',
  image: 'URL hình ảnh',
  audio: 'URL file âm thanh (mp3, wav)',
  quiz: 'Câu hỏi|A|B|C|0 (0=đáp án A)',
  code: 'Dán link CodePen',
  latex: 'Công thức LaTeX',
}

export function EmbedInsertDialog({ open, onOpenChange, type: initialType, onInsert, tr, highZIndex, blocks = [] }: EmbedInsertDialogProps) {
  const [embedType, setEmbedType] = useState<EmbedType>(initialType || 'youtube')
  const [value, setValue] = useState('')
  const [placement, setPlacement] = useState<EmbedPlacement>('end')

  const handleInsert = () => {
    const marker = buildMarker(embedType, value)
    if (marker) {
      onInsert(marker, placement)
      setValue('')
      onOpenChange(false)
    }
  }

  const zClass = 'z-[110]'
  const quizCount = (blocks ?? []).reduce((acc, b) => acc + (b.content?.match(/\[quiz:/g)?.length ?? 0), 0)
  const quizAtLimit = embedType === 'quiz' && quizCount >= 2
  const canDo = canInsert(embedType, value) && !quizAtLimit

  const dialogContent = (
    <>
      <DialogHeader>
        <DialogTitle>{tr('Chèn nội dung', 'Insert content', '插入内容', 'コンテンツを挿入', '콘텐츠 삽입')}</DialogTitle>
        <DialogDescription>{DESCRIPTIONS[embedType]}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>{tr('Loại', 'Type', '类型', 'タイプ', '유형')}</Label>
          <Select value={embedType} onValueChange={(v) => { setEmbedType(v as EmbedType); setValue('') }}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[120]">
              {EMBED_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.value === 'quiz' && quizCount >= 2}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="embed-value">
            {embedType === 'quiz' ? tr('Câu hỏi|Đáp án A|B|C|Chỉ số đúng', 'Question|Option A|B|C|Correct index', '问题|选项A|B|C|正确索引', '質問|選択肢A|B|C|正解番号', '질문|선택A|B|C|정답인덱스') :
             embedType === 'latex' ? tr('Công thức LaTeX', 'LaTeX formula', 'LaTeX公式', 'LaTeX式', 'LaTeX 공식') :
             tr('URL hoặc nội dung', 'URL or content', 'URL或内容', 'URLまたは内容', 'URL 또는 내용')}
          </Label>
          <Input
            id="embed-value"
            placeholder={PLACEHOLDERS[embedType]}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
            className="mt-1"
          />
        </div>
        <div>
          <Label>{tr('Vị trí chèn', 'Insert position', '插入位置', '挿入位置', '삽입 위치')}</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="placement" checked={placement === 'end'} onChange={() => setPlacement('end')} className="rounded" />
              <span className="text-sm">{tr('Cuối', 'End', '末尾', '末尾', '끝')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="placement" checked={placement === 'newBlock'} onChange={() => setPlacement('newBlock')} className="rounded" />
              <span className="text-sm">{tr('Block mới', 'New block', '新块', '新規ブロック', '새 블록')}</span>
            </label>
            {blocks.map((b, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="placement" checked={placement === i} onChange={() => setPlacement(i)} className="rounded" />
                <span className="text-sm truncate max-w-[100px]" title={b.header}>{b.header}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      {quizAtLimit && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {tr('Mỗi slide tối đa 2 câu trắc nghiệm.', 'Max 2 quiz questions per slide.', '每张幻灯片最多2道题。', '1スライド最大2問。', '슬라이드당 최대 2문제.')}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</Button>
        <Button onClick={handleInsert} disabled={!canDo}>{tr('Chèn', 'Insert', '插入', '挿入', '삽입')}</Button>
      </DialogFooter>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {highZIndex ? (
        <DialogPortal>
          <DialogOverlay className={zClass} />
          <DialogPrimitive.Content className={cn(
            'fixed left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
            zClass
          )}>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            {dialogContent}
          </DialogPrimitive.Content>
        </DialogPortal>
      ) : (
        <DialogContent>
          {dialogContent}
        </DialogContent>
      )}
    </Dialog>
  )
}
