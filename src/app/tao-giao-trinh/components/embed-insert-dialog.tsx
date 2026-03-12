'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { parseQuizData, type EmbedType } from './content-embed'

export type EmbedPlacement = 'end' | 'newBlock' | number

export type EmbedDialogMode = 'insert' | 'replaceImage'

interface EmbedInsertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type?: EmbedType | null
  onInsert: (marker: string, placement?: EmbedPlacement, alsoApplyToSlideIndices?: number[]) => void
  /** Thay nội dung visual slide – markerOrUrl, alsoApplyToSlideIndices, layout (1|2|4), cellIndex (0-based, -1=tất cả) */
  onReplaceSlideImage?: (markerOrUrl: string, alsoApplyToSlideIndices?: number[], layout?: 1 | 2 | 4, cellIndex?: number) => void
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  highZIndex?: boolean
  blocks?: Array<{ header: string; content?: string }>
  /** Danh sách slide (title) để chọn áp dụng thêm – khi replace visual */
  slides?: Array<{ title: string }>
  /** Slide hiện tại (0-based) – luôn áp dụng, có thể thêm slide khác */
  currentSlideIndex?: number
  /** Dữ liệu visual đang lưu (để hiển thị trước khi xóa) */
  currentVisual?: { layout: 1 | 2 | 4; cells: Array<{ visualEmbed?: string; imageUrl?: string }> }
  /** Mở với mode replace visual (từ nút Thay) */
  initialMode?: EmbedDialogMode
  /** Thay embed trong block – khi set, mở dialog để thay thế embed này */
  replaceEmbedContext?: { slideIndex: number; blockIndex: number; rawMarker: string; urlOrId: string; embedType: EmbedType } | null
  /** Callback khi thay embed trong block */
  onReplaceBlockEmbed?: (slideIndex: number, blockIndex: number, oldRawMarker: string, newMarker: string) => void
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

export function EmbedInsertDialog({ open, onOpenChange, type: initialType, onInsert, onReplaceSlideImage, tr, highZIndex, blocks = [], slides = [], currentSlideIndex = 0, currentVisual, initialMode, replaceEmbedContext, onReplaceBlockEmbed }: EmbedInsertDialogProps) {
  const [mode, setMode] = useState<EmbedDialogMode>('insert')
  const [embedType, setEmbedType] = useState<EmbedType>(initialType || 'youtube')
  const [value, setValue] = useState('')
  const [placement, setPlacement] = useState<EmbedPlacement>('end')
  const [alsoApplyTo, setAlsoApplyTo] = useState<Set<number>>(new Set())
  const [visualLayout, setVisualLayout] = useState<1 | 2 | 4>(1)
  const [visualCellIndex, setVisualCellIndex] = useState<number>(-1)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; correctIndex?: number; suggestedCorrectLetter?: string; error?: string } | null>(null)

  useEffect(() => {
    if (!open) {
      setAlsoApplyTo(new Set())
      setVisualLayout(1)
      setVisualCellIndex(-1)
      setVerifyResult(null)
    } else {
      if (initialMode === 'replaceImage' && onReplaceSlideImage) setMode('replaceImage')
      if (replaceEmbedContext) {
        setMode('insert')
        setEmbedType(replaceEmbedContext.embedType)
        setValue(replaceEmbedContext.urlOrId)
      }
    }
  }, [open, initialMode, onReplaceSlideImage, replaceEmbedContext])

  const slideContent = blocks.map((b) => `${b.header ?? ''}: ${b.content ?? ''}`).join('\n\n')
  const slideTitle = slides[currentSlideIndex]?.title ?? ''

  const handleVerifyQuiz = useCallback(async () => {
    const parsed = parseQuizData(value.trim())
    if (!parsed || parsed.options.length < 2) return
    setVerifyLoading(true)
    setVerifyResult(null)
    try {
      const res = await fetch('/api/slide-verify-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideTitle,
          slideContent,
          question: parsed.question,
          options: parsed.options,
          correctIndex: parsed.correctIndex,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVerifyResult({ verified: false, error: data.error ?? 'Lỗi kiểm tra' })
        return
      }
      setVerifyResult({
        verified: data.verified === true,
        correctIndex: data.correctIndex,
        suggestedCorrectLetter: data.suggestedCorrectLetter,
        error: data.error,
      })
    } catch (e) {
      setVerifyResult({ verified: false, error: e instanceof Error ? e.message : 'Lỗi kết nối' })
    } finally {
      setVerifyLoading(false)
    }
  }, [value, slideTitle, slideContent])

  const applySuggestedCorrectIndex = useCallback(() => {
    const parsed = parseQuizData(value.trim())
    const r = verifyResult
    if (!parsed || typeof r?.correctIndex !== 'number' || r.correctIndex < 0 || r.correctIndex > 3) return
    const parts = value.trim().split('|')
    if (parts.length >= 6) {
      parts[parts.length - 1] = String(r.correctIndex)
      setValue(parts.join('|'))
      setVerifyResult(null)
    }
  }, [value, verifyResult])

  const handleInsert = () => {
    if (replaceEmbedContext && onReplaceBlockEmbed) {
      const v = value.trim()
      const marker = v.startsWith('[') ? v : buildMarker(embedType, v)
      if (marker && canInsert(embedType, v)) {
        onReplaceBlockEmbed(replaceEmbedContext.slideIndex, replaceEmbedContext.blockIndex, replaceEmbedContext.rawMarker, marker)
        setValue('')
        onOpenChange(false)
      }
      return
    }
    if (mode === 'replaceImage' && onReplaceSlideImage) {
      const v = value.trim()
      const marker = v.startsWith('[') ? v : buildMarker(embedType, v)
      if (marker && (v.startsWith('http') || v.startsWith('data:') || marker.startsWith('['))) {
        const indices = alsoApplyTo.size > 0 ? Array.from(alsoApplyTo) : undefined
        const cellIdx = visualCellIndex >= 0 ? visualCellIndex : undefined
        onReplaceSlideImage(marker, indices, visualLayout === 1 ? 1 : visualLayout, cellIdx)
        setValue('')
        setAlsoApplyTo(new Set())
        onOpenChange(false)
      }
      return
    }
    const marker = buildMarker(embedType, value)
    if (marker) {
      const indices = alsoApplyTo.size > 0 ? Array.from(alsoApplyTo) : undefined
      onInsert(marker, placement, indices)
      setValue('')
      setAlsoApplyTo(new Set())
      onOpenChange(false)
    }
  }

  const zClass = 'z-[110]'
  const quizCount = (blocks ?? []).reduce((acc, b) => acc + (b.content?.match(/\[quiz:/g)?.length ?? 0), 0)
  const quizAtLimit = embedType === 'quiz' && quizCount >= 1 && mode === 'insert'
  const canInsertContent = canInsert(embedType, value) && !quizAtLimit
  const canReplaceVisual = canInsert(embedType, value)
  const canDo = replaceEmbedContext ? canReplaceVisual : (mode === 'replaceImage' ? canReplaceVisual : canInsertContent)

  const dialogContent = (
    <>
      <DialogHeader>
        <DialogTitle>{tr('Chèn / Thay ảnh', 'Insert / Replace image', '插入/替换图片', '挿入/画像差し替え', '삽입/이미지 교체')}</DialogTitle>
        <DialogDescription>
          {replaceEmbedContext
            ? tr('Thay embed này bằng nội dung mới', 'Replace this embed with new content', '用新内容替换此嵌入', 'この埋め込みを新しい内容で差し替え', '이 임베드를 새 내용으로 교체')
            : mode === 'replaceImage'
            ? tr('Thay nội dung visual slide (YouTube, ảnh, GeoGebra, LaTeX... bên trái)', 'Replace slide visual (YouTube, image, GeoGebra, LaTeX... left side)', '替换幻灯片视觉内容（左侧：YouTube、图片、GeoGebra、LaTeX等）', 'スライドのビジュアルを差し替え（左側：YouTube、画像、GeoGebra、LaTeX等）', '슬라이드 비주얼 교체 (왼쪽: YouTube, 이미지, GeoGebra, LaTeX 등)')
            : DESCRIPTIONS[embedType]}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        {onReplaceSlideImage && !replaceEmbedContext && (
          <div className="flex gap-2 border-b pb-3">
            <Button variant={mode === 'insert' ? 'default' : 'outline'} size="sm" onClick={() => setMode('insert')}>
              {tr('Chèn vào slide', 'Insert into slide', '插入到幻灯片', 'スライドに挿入', '슬라이드에 삽입')}
            </Button>
            <Button variant={mode === 'replaceImage' ? 'default' : 'outline'} size="sm" onClick={() => setMode('replaceImage')}>
              {tr('Thay visual slide', 'Replace slide visual', '替换幻灯片视觉', 'スライドのビジュアルを差し替え', '슬라이드 비주얼 교체')}
            </Button>
          </div>
        )}
        {replaceEmbedContext ? (
          <>
            <div>
              <Label>{tr('Loại', 'Type', '类型', 'タイプ', '유형')}</Label>
              <Select value={embedType} onValueChange={(v) => { setEmbedType(v as EmbedType); setValue('') }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  {EMBED_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="embed-value-replace-ctx">{tr('URL hoặc nội dung', 'URL or content', 'URL或内容', 'URLまたは内容', 'URL 또는 내용')}</Label>
              <Input
                id="embed-value-replace-ctx"
                placeholder={PLACEHOLDERS[embedType]}
                value={value}
                onChange={(e) => { setValue(e.target.value); setVerifyResult(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
                className="mt-1"
              />
            </div>
          </>
        ) : mode === 'replaceImage' ? (
          <>
            <div>
              <Label>{tr('Chia ô visual', 'Visual layout', '视觉分区', 'ビジュアル分割', '비주얼 레이아웃')}</Label>
              <div className="flex gap-2 mt-2">
                <Button variant={visualLayout === 1 ? 'default' : 'outline'} size="sm" onClick={() => { setVisualLayout(1); setVisualCellIndex(-1) }}>
                  {tr('1 ô', '1 cell', '1格', '1マス', '1칸')}
                </Button>
                <Button variant={visualLayout === 2 ? 'default' : 'outline'} size="sm" onClick={() => { setVisualLayout(2); setVisualCellIndex(-1) }}>
                  {tr('Chia 2 (trên/dưới)', 'Split 2 (top/bottom)', '分2格', '2分割', '2칸')}
                </Button>
                <Button variant={visualLayout === 4 ? 'default' : 'outline'} size="sm" onClick={() => { setVisualLayout(4); setVisualCellIndex(-1) }}>
                  {tr('Chia 4', 'Split 4', '分4格', '4分割', '4칸')}
                </Button>
              </div>
            </div>
            {(visualLayout === 2 || visualLayout === 4) && (
              <div>
                <Label className="text-muted-foreground">{tr('Áp dụng vào ô', 'Apply to cell', '应用于格', '適用するマス', '적용할 칸')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button variant={visualCellIndex === -1 ? 'default' : 'outline'} size="sm" onClick={() => setVisualCellIndex(-1)}>
                    {tr('Tất cả', 'All', '全部', 'すべて', '전체')}
                  </Button>
                  {Array.from({ length: visualLayout }, (_, i) => (
                    <Button key={i} variant={visualCellIndex === i ? 'default' : 'outline'} size="sm" onClick={() => setVisualCellIndex(i)}>
                      {i + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>{tr('Loại', 'Type', '类型', 'タイプ', '유형')}</Label>
              <Select value={embedType} onValueChange={(v) => { setEmbedType(v as EmbedType); setValue('') }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  {EMBED_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="embed-value-replace">
                {embedType === 'quiz' ? tr('Câu hỏi|Đáp án A|B|C|Chỉ số đúng', 'Question|Option A|B|C|Correct index', '问题|选项A|B|C|正确索引', '質問|選択肢A|B|C|正解番号', '질문|선택A|B|C|정답인덱스') :
               embedType === 'latex' ? tr('Công thức LaTeX', 'LaTeX formula', 'LaTeX公式', 'LaTeX式', 'LaTeX 공식') :
               tr('URL hoặc nội dung', 'URL or content', 'URL或内容', 'URLまたは内容', 'URL 또는 내용')}
              </Label>
              <Input
                id="embed-value-replace"
                placeholder={PLACEHOLDERS[embedType]}
                value={value}
                onChange={(e) => { setValue(e.target.value); setVerifyResult(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
                className="mt-1"
              />
              {embedType === 'quiz' && canReplaceVisual && slideContent.trim() && (
                <div className="mt-2 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyQuiz}
                    disabled={verifyLoading}
                    className="text-violet-600 border-violet-400/50 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-500/50 dark:hover:bg-violet-950/30"
                  >
                    {verifyLoading ? tr('Đang kiểm tra...', 'Verifying...', '正在验证...', '検証中...', '검증 중...') : tr('Kiểm tra bằng AI', 'Verify with AI', 'AI验证', 'AIで検証', 'AI로 검증')}
                  </Button>
                  {verifyResult && (
                    <div className={`rounded-lg border p-2.5 text-sm ${verifyResult.verified ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'}`}>
                      {verifyResult.verified ? (
                        <span>{tr('Đáp án đúng theo nội dung slide.', 'Answer matches slide content.', '答案与幻灯片内容一致。', '正解はスライド内容と一致。', '정답이 슬라이드 내용과 일치합니다.')}</span>
                      ) : verifyResult.error ? (
                        <span>{verifyResult.error}</span>
                      ) : (
                        <div className="space-y-1.5">
                          <span>{tr('Đáp án có thể sai. Đáp án đúng theo slide:', 'Answer may be wrong. Correct answer per slide:', '答案可能错误。根据幻灯片正确答案：', '正解が違う可能性。スライドに正解：', '정답이 틀렸을 수 있습니다. 슬라이드 기준 정답:')} <strong>{verifyResult.suggestedCorrectLetter ?? String.fromCharCode(65 + (verifyResult.correctIndex ?? 0))}</strong></span>
                          {typeof verifyResult.correctIndex === 'number' && (
                            <Button type="button" variant="outline" size="sm" onClick={applySuggestedCorrectIndex} className="mt-1 h-7 text-xs">
                              {tr('Sửa thành đáp án', 'Fix to answer', '修正为答案', '正解に修正', '정답으로 수정')} {verifyResult.suggestedCorrectLetter ?? String.fromCharCode(65 + verifyResult.correctIndex)}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            {slides.length > 1 && (
              <div>
                <Label className="text-muted-foreground">
                  {tr('Cũng áp dụng cho slide khác', 'Also apply to other slides', '同时应用于其他幻灯片', '他のスライドにも適用', '다른 슬라이드에도 적용')}
                </Label>
                <div className="mt-2 max-h-32 overflow-y-auto flex flex-wrap gap-2 rounded-md border p-2 bg-muted/30">
                  {slides.map((s, i) => {
                    if (i === currentSlideIndex) return null
                    const checked = alsoApplyTo.has(i)
                    return (
                      <label key={i} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setAlsoApplyTo((prev) => {
                            const next = new Set(prev)
                            if (next.has(i)) next.delete(i)
                            else next.add(i)
                            return next
                          })}
                          className="rounded"
                        />
                        <span className="truncate max-w-[140px]" title={s.title}>
                          {i + 1}. {s.title}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <Label>{tr('Loại', 'Type', '类型', 'タイプ', '유형')}</Label>
              <Select value={embedType} onValueChange={(v) => { setEmbedType(v as EmbedType); setValue('') }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  {EMBED_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} disabled={o.value === 'quiz' && quizCount >= 1}>
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
                onChange={(e) => { setValue(e.target.value); setVerifyResult(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
                className="mt-1"
              />
              {embedType === 'quiz' && canInsertContent && slideContent.trim() && (
                <div className="mt-2 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyQuiz}
                    disabled={verifyLoading}
                    className="text-violet-600 border-violet-400/50 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-500/50 dark:hover:bg-violet-950/30"
                  >
                    {verifyLoading ? tr('Đang kiểm tra...', 'Verifying...', '正在验证...', '検証中...', '검증 중...') : tr('Kiểm tra bằng AI', 'Verify with AI', 'AI验证', 'AIで検証', 'AI로 검증')}
                  </Button>
                  {verifyResult && (
                    <div className={`rounded-lg border p-2.5 text-sm ${verifyResult.verified ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'}`}>
                      {verifyResult.verified ? (
                        <span>{tr('Đáp án đúng theo nội dung slide.', 'Answer matches slide content.', '答案与幻灯片内容一致。', '正解はスライド内容と一致。', '정답이 슬라이드 내용과 일치합니다.')}</span>
                      ) : verifyResult.error ? (
                        <span>{verifyResult.error}</span>
                      ) : (
                        <div className="space-y-1.5">
                          <span>{tr('Đáp án có thể sai. Đáp án đúng theo slide:', 'Answer may be wrong. Correct answer per slide:', '答案可能错误。根据幻灯片正确答案：', '正解が違う可能性。スライドに正解：', '정답이 틀렸을 수 있습니다. 슬라이드 기준 정답:')} <strong>{verifyResult.suggestedCorrectLetter ?? String.fromCharCode(65 + (verifyResult.correctIndex ?? 0))}</strong></span>
                          {typeof verifyResult.correctIndex === 'number' && (
                            <Button type="button" variant="outline" size="sm" onClick={applySuggestedCorrectIndex} className="mt-1 h-7 text-xs">
                              {tr('Sửa thành đáp án', 'Fix to answer', '修正为答案', '正解に修正', '정답으로 수정')} {verifyResult.suggestedCorrectLetter ?? String.fromCharCode(65 + verifyResult.correctIndex)}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
            {slides.length > 1 && (
              <div>
                <Label className="text-muted-foreground">
                  {tr('Cũng chèn vào slide khác', 'Also insert into other slides', '同时插入到其他幻灯片', '他のスライドにも挿入', '다른 슬라이드에도 삽입')}
                </Label>
                <div className="mt-2 max-h-32 overflow-y-auto flex flex-wrap gap-2 rounded-md border p-2 bg-muted/30">
                  {slides.map((s, i) => {
                    if (i === currentSlideIndex) return null
                    const checked = alsoApplyTo.has(i)
                    return (
                      <label key={i} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setAlsoApplyTo((prev) => {
                            const next = new Set(prev)
                            if (next.has(i)) next.delete(i)
                            else next.add(i)
                            return next
                          })}
                          className="rounded"
                        />
                        <span className="truncate max-w-[140px]" title={s.title}>
                          {i + 1}. {s.title}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {mode === 'insert' && quizAtLimit && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {tr('Mỗi slide 1 câu trắc nghiệm.', '1 quiz question per slide.', '每张幻灯片1道题。', '1スライド1問。', '슬라이드당 1문제.')}
        </p>
      )}
      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</Button>
        <Button onClick={handleInsert} disabled={!canDo}>
          {replaceEmbedContext || mode === 'replaceImage' ? tr('Thay', 'Replace', '替换', '差し替え', '교체') : tr('Chèn', 'Insert', '插入', '挿入', '삽입')}
        </Button>
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
