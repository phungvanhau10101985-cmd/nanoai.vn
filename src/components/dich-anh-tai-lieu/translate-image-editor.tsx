'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WebLocale } from '@/lib/i18n/config'
import { eraseMatchedColor, hexToRgb, rgbToHex, type Rgb } from '@/lib/dich-anh-tai-lieu/edit-image-source'
import { textCaretRect } from '@/lib/dich-anh-tai-lieu/text-caret'

export type TranslateEditPage = { id: string; label: string; src: string }

type Tool = 'pick' | 'erase' | 'brush' | 'rect' | 'text'
type FloatText = { id: string; x: number; y: number; text: string; size: number; fontId: string; color: string }
type PageBackup = { canvas: HTMLCanvasElement; undo: HTMLCanvasElement[]; redo: HTMLCanvasElement[] }

const FONTS: Array<{ id: string; family: string; vi: string; en: string; zh: string; ja: string; ko: string }> = [
  { id: 'sans', family: 'system-ui, "Segoe UI", sans-serif', vi: 'Sans', en: 'Sans', zh: '黑体', ja: 'ゴシック', ko: '고딕' },
  { id: 'serif', family: 'Georgia, "Times New Roman", serif', vi: 'Serif', en: 'Serif', zh: '宋体', ja: '明朝', ko: '명조' },
  { id: 'cjk', family: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans", "Yu Gothic", "Malgun Gothic", sans-serif', vi: 'Chữ Á', en: 'CJK', zh: '中日韩', ja: '日中韓', ko: '한중일' },
]

function tr(locale: WebLocale, vi: string, en: string, zh: string, ja: string, ko: string): string {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  copy.getContext('2d')!.drawImage(source, 0, 0)
  return copy
}

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  return ctx
}

function normRect(x0: number, y0: number, x1: number, y1: number, width: number, height: number) {
  const left = Math.max(0, Math.min(x0, x1))
  const top = Math.max(0, Math.min(y0, y1))
  const right = Math.min(width, Math.max(x0, x1))
  const bottom = Math.min(height, Math.max(y0, y1))
  return { x: Math.floor(left), y: Math.floor(top), w: Math.ceil(right - left), h: Math.ceil(bottom - top) }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para) {
      lines.push('')
      continue
    }
    const tokens = para.split(/(\s+)/).flatMap((tok) => {
      if (!tok) return []
      if (/^\s+$/.test(tok) || ctx.measureText(tok).width <= maxWidth) return [tok]
      return [...tok]
    })
    let line = ''
    for (const tok of tokens) {
      const next = line + tok
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line.replace(/\s+$/, ''))
        line = /^\s+$/.test(tok) ? '' : tok.trimStart()
      } else {
        line = next
      }
    }
    lines.push(line)
  }
  return lines
}

function paintText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  family: string,
  color: string,
  showCaret: boolean
) {
  ctx.save()
  ctx.font = `${fontSize}px ${family}`
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const lines = text.trim() ? wrapText(ctx, text, maxWidth) : []
  const lineHeight = fontSize * 1.25
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
  if (showCaret) {
    const last = lines.length > 0 ? lines[lines.length - 1] : ''
    const caret = textCaretRect(x, y + Math.max(0, lines.length - 1) * lineHeight, fontSize, last ? ctx.measureText(last).width : 0)
    ctx.fillRect(caret.x, caret.y, caret.w, caret.h)
  }
  ctx.restore()
}

async function fetchImageBlob(src: string): Promise<Blob> {
  const url = src.startsWith('blob:') || src.startsWith('data:') || src.startsWith('/')
    ? src
    : `/api/dich-anh-tai-lieu/source-image?url=${encodeURIComponent(src)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(String(res.status))
  return res.blob()
}

async function paintUrl(canvas: HTMLCanvasElement, src: string) {
  const blob = await fetchImageBlob(src)
  const bitmap = await createImageBitmap(blob)
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvasContext(canvas).drawImage(bitmap, 0, 0)
  bitmap.close()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png'))), 'image/png')
  })
}

export function TranslateImageEditButton({
  pages,
  startIndex = 0,
  locale,
  className,
  size = 'sm',
  label,
}: {
  pages: TranslateEditPage[]
  startIndex?: number
  locale: WebLocale
  className?: string
  size?: 'sm' | 'default'
  label?: string
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const page = pages[startIndex]
  if (!page?.src) return null
  return (
    <>
      <Button type="button" size={size} variant="outline" className={className} onClick={() => setOpenIndex(startIndex)}>
        {label || tr(locale, 'Sửa ảnh', 'Edit image', '编辑图片', '画像を編集', '이미지 편집')}
      </Button>
      {openIndex != null ? (
        <TranslateImageEditor
          pages={pages}
          startIndex={openIndex}
          locale={locale}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </>
  )
}

export function TranslateImageEditor({
  pages,
  startIndex,
  locale,
  onClose,
}: {
  pages: TranslateEditPage[]
  startIndex: number
  locale: WebLocale
  onClose: () => void
}) {
  const copy = {
    title: tr(locale, 'Sửa ảnh đã dịch', 'Edit the translated image', '编辑已翻译的图片', '翻訳した画像を編集', '번역된 이미지 편집'),
    hint: tr(
      locale,
      'Hút màu, kéo ô để xóa đúng màu đó, tô hoặc gõ chữ. Chữ nổi trên ảnh và kéo được. Tải PNG hoặc PDF thì chữ mới dính vào ảnh.',
      'Pick a color, drag a box to erase that color, fill, or type. Text floats on the image and can be dragged. It is baked in only when you download PNG or PDF.',
      '吸色，拖框擦色，填充或打字。文字浮在图片上，可以拖动。只有下载 PNG 或 PDF 时才写进图片。',
      '色を吸い、枠で消し、塗るか文字を打つ。文字は画像の上に浮き、ドラッグできます。PNG か PDF を保存したときだけ画像に固定されます。',
      '색을 찍고, 상자로 지우고, 칠하거나 입력하세요. 글자는 이미지 위에 떠 있고 끌 수 있습니다. PNG나 PDF로 받을 때만 이미지에 붙습니다.'
    ),
    pick: tr(locale, 'Hút màu', 'Pick color', '吸色', '色を吸う', '색 찍기'),
    colorLabel: tr(locale, 'Màu', 'Color', '颜色', '色', '색'),
    erase: tr(locale, 'Xóa màu', 'Erase color', '擦除颜色', '色を消す', '색 지우기'),
    brush: tr(locale, 'Tô', 'Brush', '画笔', 'ブラシ', '붓'),
    rect: tr(locale, 'Tô ô', 'Fill box', '填充方框', '四角を塗る', '상자 칠하기'),
    text: tr(locale, 'Gõ chữ', 'Type', '打字', '文字', '글자 입력'),
    undo: tr(locale, 'Hoàn tác', 'Undo', '撤销', '元に戻す', '실행 취소'),
    redo: tr(locale, 'Làm lại', 'Redo', '重做', 'やり直す', '다시 실행'),
    reload: tr(locale, 'Bỏ sửa', 'Discard edits', '放弃修改', '編集を捨てる', '편집 버리기'),
    png: tr(locale, 'Tải PNG', 'Download PNG', '下载 PNG', 'PNGを保存', 'PNG 받기'),
    pdf: tr(locale, 'Tải PDF đã sửa', 'Download edited PDF', '下载改过的 PDF', '編集したPDF', '수정한 PDF'),
    place: tr(locale, 'Đặt chữ', 'Place text', '放上文字', '文字を置く', '글자 놓기'),
    textPlaceholder: tr(locale, 'Gõ chữ, kéo trên ảnh để đặt', 'Type, then drag it on the image', '输入后在图片上拖动放置', '入力して画像上でドラッグ', '입력 후 이미지에서 끌어 놓기'),
    tolerance: tr(locale, 'Độ lệch', 'Tolerance', '容差', '許容', '허용'),
    brushSize: tr(locale, 'Cỡ cọ', 'Brush size', '笔刷大小', 'ブラシサイズ', '붓 크기'),
    fontSize: tr(locale, 'Cỡ chữ', 'Text size', '字号', '文字サイズ', '글자 크기'),
    loading: tr(locale, 'Đang mở ảnh...', 'Opening image...', '正在打开图片...', '画像を開いています...', '이미지를 여는 중...'),
    failed: tr(locale, 'Không mở được ảnh.', 'Could not open the image.', '无法打开图片。', '画像を開けません。', '이미지를 열 수 없습니다.'),
    saving: tr(locale, 'Đang tạo file...', 'Creating file...', '正在生成文件...', 'ファイルを作成中...', '파일 만드는 중...'),
  }

  const viewRef = useRef<HTMLCanvasElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const writeDraftRef = useRef<(text: string, point?: { x: number; y: number }) => void>(() => {})
  const labelsByPageRef = useRef(new Map<string, FloatText[]>())
  const labelsRef = useRef<FloatText[]>([])
  const activeIdRef = useRef<string | null>(null)
  const viewScaleRef = useRef(1)
  const pagesRef = useRef(pages)
  pagesRef.current = pages
  const storeRef = useRef(new Map<string, PageBackup>())
  const dirtyRef = useRef(new Set<string>())
  const undoRef = useRef<HTMLCanvasElement[]>([])
  const redoRef = useRef<HTMLCanvasElement[]>([])
  const pageIndexRef = useRef(startIndex)
  const toolRef = useRef<Tool>('pick')
  const colorRef = useRef('#111111')
  const toleranceRef = useRef(28)
  const brushRef = useRef(24)
  const fontSizeRef = useRef(32)
  const fontIdRef = useRef('sans')
  const dragRef = useRef<{ kind: 'erase' | 'rect' | 'brush'; x: number; y: number; before: HTMLCanvasElement } | null>(null)
  const genRef = useRef(0)
  const sizedRef = useRef(false)

  const [tool, setTool] = useState<Tool>('pick')
  const [color, setColor] = useState('#111111')
  const [tolerance, setTolerance] = useState(28)
  const [brushSize, setBrushSize] = useState(24)
  const [fontSize, setFontSize] = useState(32)
  const [fontId, setFontId] = useState('sans')
  const [pageIndex, setPageIndex] = useState(startIndex)
  const [labels, setLabels] = useState<FloatText[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [viewScale, setViewScale] = useState(1)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [historyTick, setHistoryTick] = useState(0)

  toolRef.current = tool
  colorRef.current = color
  toleranceRef.current = tolerance
  brushRef.current = brushSize
  fontSizeRef.current = fontSize
  fontIdRef.current = fontId
  labelsRef.current = labels
  activeIdRef.current = activeId
  pageIndexRef.current = pageIndex
  loadingRef.current = loading

  const fontFamily = FONTS.find((item) => item.id === fontId)?.family || FONTS[0].family

  function bumpHistory() {
    setHistoryTick((n) => n + 1)
  }

  function undoLimit(canvas: HTMLCanvasElement) {
    return canvas.width * canvas.height > 5_000_000 ? 3 : 6
  }

  function pushUndo(before: HTMLCanvasElement, canvas: HTMLCanvasElement) {
    const id = pagesRef.current[pageIndexRef.current]?.id
    undoRef.current.push(before)
    redoRef.current = []
    const max = undoLimit(canvas)
    while (undoRef.current.length > max) undoRef.current.shift()
    if (id) dirtyRef.current.add(id)
    bumpHistory()
  }

  function focusTextInput() {
    const node = textInputRef.current
    if (!node) return
    node.focus({ preventScroll: true })
    const end = node.value.length
    node.setSelectionRange(end, end)
  }

  function fontFamilyOf(id: string) {
    return FONTS.find((item) => item.id === id)?.family || FONTS[0].family
  }

  function setLabelList(next: FloatText[]) {
    labelsRef.current = next
    setLabels(next)
  }

  function patchLabel(id: string, patch: Partial<FloatText>) {
    setLabelList(labelsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function writeActive(text: string, point?: { x: number; y: number }) {
    const canvas = viewRef.current
    const id = activeIdRef.current
    const found = id ? labelsRef.current.find((item) => item.id === id) : undefined
    const spot = point ?? {
      x: found?.x ?? Math.round((canvas?.width || 400) * 0.08),
      y: found?.y ?? Math.round((canvas?.height || 400) * 0.08),
    }
    if (!found) {
      const created: FloatText = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        x: spot.x,
        y: spot.y,
        text,
        size: fontSizeRef.current,
        fontId: fontIdRef.current,
        color: colorRef.current,
      }
      activeIdRef.current = created.id
      setActiveId(created.id)
      setLabelList([...labelsRef.current, created])
      return
    }
    patchLabel(found.id, {
      text,
      x: spot.x,
      y: spot.y,
      size: fontSizeRef.current,
      fontId: fontIdRef.current,
      color: colorRef.current,
    })
  }
  writeDraftRef.current = writeActive

  function finishActive() {
    const id = activeIdRef.current
    if (!id) return
    const label = labelsRef.current.find((item) => item.id === id)
    if (!label || !label.text.trim()) setLabelList(labelsRef.current.filter((item) => item.id !== id))
    activeIdRef.current = null
    setActiveId(null)
  }

  function bakeLabels(canvas: HTMLCanvasElement, items: FloatText[]) {
    const out = cloneCanvas(canvas)
    const ctx = canvasContext(out)
    for (const label of items) {
      if (!label.text.trim()) continue
      paintText(ctx, label.text, label.x, label.y, Math.max(40, out.width - label.x - 8), label.size, fontFamilyOf(label.fontId), label.color, false)
    }
    return out
  }

  function rememberCurrent() {
    const canvas = viewRef.current
    const id = pagesRef.current[pageIndexRef.current]?.id
    if (!canvas || !id || !dirtyRef.current.has(id)) return
    storeRef.current.set(id, { canvas: cloneCanvas(canvas), undo: undoRef.current, redo: redoRef.current })
  }

  async function showPage(index: number) {
    const ticket = ++genRef.current
    const list = pagesRef.current
    const page = list[index]
    const canvas = viewRef.current
    if (!page || !canvas) return
    const leavingId = pagesRef.current[pageIndexRef.current]?.id
    if (leavingId && index !== pageIndexRef.current) {
      labelsByPageRef.current.set(leavingId, labelsRef.current)
      rememberCurrent()
      activeIdRef.current = null
      setActiveId(null)
      setLabelList([])
    }
    setLoading(true)
    setError(null)
    try {
      const saved = storeRef.current.get(page.id)
      if (saved) {
        canvas.width = saved.canvas.width
        canvas.height = saved.canvas.height
        canvasContext(canvas).drawImage(saved.canvas, 0, 0)
        undoRef.current = saved.undo
        redoRef.current = saved.redo
      } else {
        await paintUrl(canvas, page.src)
        if (ticket !== genRef.current) return
        undoRef.current = []
        redoRef.current = []
        if (!sizedRef.current) {
          sizedRef.current = true
          const nextBrush = Math.max(8, Math.min(80, Math.round(canvas.width / 80)))
          const nextFont = Math.max(18, Math.min(120, Math.round(canvas.width / 40)))
          brushRef.current = nextBrush
          fontSizeRef.current = nextFont
          setBrushSize(nextBrush)
          setFontSize(nextFont)
        }
      }
      if (ticket !== genRef.current) return
      pageIndexRef.current = index
      const stored = labelsByPageRef.current.get(page.id) ?? []
      activeIdRef.current = null
      setActiveId(null)
      setLabelList(stored)
      setCanvasSize({ w: canvas.width, h: canvas.height })
      setPageIndex(index)
      setLoading(false)
      bumpHistory()
    } catch {
      if (ticket !== genRef.current) return
      setLoading(false)
      setError(copy.failed)
    }
  }

  useEffect(() => {
    const start = Math.min(startIndex, Math.max(0, pages.length - 1))
    let frames = 0
    let timer = 0
    const kick = () => {
      if (!viewRef.current && frames < 30) {
        frames += 1
        timer = window.requestAnimationFrame(kick)
        return
      }
      void showPage(start)
    }
    kick()
    const store = storeRef.current
    const dirty = dirtyRef.current
    return () => {
      window.cancelAnimationFrame(timer)
      genRef.current += 1
      store.clear()
      dirty.clear()
    }
    // Chỉ nạp khi mở. Đổi trang đi qua showPage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = activeIdRef.current
    if (!id) return
    const current = labelsRef.current.find((item) => item.id === id)
    if (!current || (current.size === fontSize && current.fontId === fontId && current.color === color)) return
    patchLabel(id, { size: fontSize, fontId, color })
    // patchLabel đọc danh sách mới nhất trong ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize, fontId, color])

  useEffect(() => {
    const canvas = viewRef.current
    if (!canvas) return
    const apply = () => {
      if (canvas.width < 2) return
      const scale = canvas.clientWidth / canvas.width
      viewScaleRef.current = scale > 0 ? scale : 1
      setViewScale(viewScaleRef.current)
      setCanvasSize({ w: canvas.width, h: canvas.height })
    }
    const observer = new ResizeObserver(apply)
    observer.observe(canvas)
    apply()
    return () => observer.disconnect()
  }, [pageIndex, loading])

  useEffect(() => {
    if (tool !== 'text') return
    const timer = window.setTimeout(() => {
      const node = textInputRef.current
      if (!node) return
      node.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [tool])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      const inField = target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement
      if (event.key === 'Escape') {
        if (activeIdRef.current) {
          event.preventDefault()
          finishActive()
        }
        return
      }
      if (inField) return
      if (target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) return
      const meta = event.ctrlKey || event.metaKey
      if (toolRef.current === 'text' && !meta && !event.altKey && !event.isComposing) {
        const current = labelsRef.current.find((item) => item.id === activeIdRef.current)?.text || ''
        if (event.key === 'Backspace') {
          event.preventDefault()
          writeDraftRef.current(Array.from(current).slice(0, -1).join(''))
          textInputRef.current?.focus({ preventScroll: true })
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          writeDraftRef.current(`${current}\n`)
          textInputRef.current?.focus({ preventScroll: true })
          return
        }
        if (event.key.length === 1) {
          event.preventDefault()
          writeDraftRef.current(current + event.key)
          textInputRef.current?.focus({ preventScroll: true })
          return
        }
      }
      if (!meta) return
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function undo() {
    if (dragRef.current) return
    const canvas = viewRef.current
    const prev = undoRef.current.pop()
    if (!canvas || !prev) return
    redoRef.current.push(cloneCanvas(canvas))
    canvas.width = prev.width
    canvas.height = prev.height
    canvasContext(canvas).drawImage(prev, 0, 0)
    bumpHistory()
  }

  function redo() {
    if (dragRef.current) return
    const canvas = viewRef.current
    const next = redoRef.current.pop()
    if (!canvas || !next) return
    undoRef.current.push(cloneCanvas(canvas))
    canvas.width = next.width
    canvas.height = next.height
    canvasContext(canvas).drawImage(next, 0, 0)
    bumpHistory()
  }

  function pointOf(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = Math.round(((event.clientX - rect.left) / rect.width) * canvas.width)
    const y = Math.round(((event.clientY - rect.top) / rect.height) * canvas.height)
    return {
      x: Math.max(0, Math.min(canvas.width - 1, x)),
      y: Math.max(0, Math.min(canvas.height - 1, y)),
    }
  }

  function onLabelPointerDown(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    event.preventDefault()
    event.stopPropagation()
    const label = labelsRef.current.find((item) => item.id === id)
    if (!label) return
    activeIdRef.current = id
    setActiveId(id)
    const scale = viewScaleRef.current || 1
    const origin = { x: event.clientX, y: event.clientY, lx: label.x, ly: label.y }
    const move = (pointer: PointerEvent) => {
      const canvas = viewRef.current
      const maxX = Math.max(0, (canvas?.width || 1) - 8)
      const maxY = Math.max(0, (canvas?.height || 1) - 8)
      const x = Math.round(Math.max(0, Math.min(maxX, origin.lx + (pointer.clientX - origin.x) / scale)))
      const y = Math.round(Math.max(0, Math.min(maxY, origin.ly + (pointer.clientY - origin.y) / scale)))
      patchLabel(id, { x, y })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (toolRef.current === 'text') focusTextInput()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (loading || error) return
    const canvas = event.currentTarget
    const ctx = canvasContext(canvas)
    const point = pointOf(event)
    if (toolRef.current === 'pick') {
      const pixel = ctx.getImageData(point.x, point.y, 1, 1).data
      if (pixel[3] < 16) return
      const next = rgbToHex({ r: pixel[0], g: pixel[1], b: pixel[2] })
      colorRef.current = next
      setColor(next)
      return
    }
    if (toolRef.current === 'text') {
      event.preventDefault()
      const current = labelsRef.current.find((item) => item.id === activeIdRef.current)
      writeActive(current?.text || '', point)
      focusTextInput()
      return
    }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Con trỏ giả không giữ được. */ }
    const before = cloneCanvas(canvas)
    if (toolRef.current === 'brush') {
      dragRef.current = { kind: 'brush', x: point.x, y: point.y, before }
      pushUndo(before, canvas)
      ctx.fillStyle = colorRef.current
      ctx.beginPath()
      ctx.arc(point.x, point.y, brushRef.current / 2, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    dragRef.current = { kind: toolRef.current === 'erase' ? 'erase' : 'rect', x: point.x, y: point.y, before }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    const canvas = viewRef.current
    if (!drag || !canvas) return
    const point = pointOf(event)
    const ctx = canvasContext(canvas)
    if (drag.kind === 'brush') {
      ctx.strokeStyle = colorRef.current
      ctx.lineWidth = brushRef.current
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(drag.x, drag.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
      drag.x = point.x
      drag.y = point.y
      return
    }
    const box = normRect(drag.x, drag.y, point.x, point.y, canvas.width, canvas.height)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(drag.before, 0, 0)
    ctx.save()
    ctx.strokeStyle = colorRef.current
    ctx.lineWidth = Math.max(1, Math.round(canvas.width / 600))
    ctx.strokeRect(box.x, box.y, box.w, box.h)
    ctx.restore()
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (toolRef.current === 'text') focusTextInput()
    const drag = dragRef.current
    const canvas = viewRef.current
    dragRef.current = null
    if (!drag || !canvas || drag.kind === 'brush') return
    const point = pointOf(event)
    const ctx = canvasContext(canvas)
    const box = normRect(drag.x, drag.y, point.x, point.y, canvas.width, canvas.height)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(drag.before, 0, 0)
    if (box.w < 2 || box.h < 2) return
    if (drag.kind === 'rect') {
      ctx.fillStyle = colorRef.current
      ctx.fillRect(box.x, box.y, box.w, box.h)
    } else {
      const rgb: Rgb | null = hexToRgb(colorRef.current)
      if (!rgb) return
      const image = ctx.getImageData(box.x, box.y, box.w, box.h)
      const changed = eraseMatchedColor(image.data, rgb, toleranceRef.current)
      if (changed === 0) return
      ctx.putImageData(image, box.x, box.y)
    }
    pushUndo(drag.before, canvas)
  }

  async function reloadPage() {
    const canvas = viewRef.current
    const page = pagesRef.current[pageIndexRef.current]
    if (!canvas || !page || loading) return
    labelsByPageRef.current.delete(page.id)
    activeIdRef.current = null
    setActiveId(null)
    setLabelList([])
    const before = cloneCanvas(canvas)
    setLoading(true)
    try {
      await paintUrl(canvas, page.src)
      pushUndo(before, canvas)
      storeRef.current.delete(page.id)
      setLoading(false)
    } catch {
      canvasContext(canvas).drawImage(before, 0, 0)
      setLoading(false)
      setError(copy.failed)
    }
  }

  async function savePng() {
    const canvas = viewRef.current
    if (!canvas || loading) return
    setBusy(true)
    try {
      const blob = await canvasPng(bakeLabels(canvas, labelsRef.current))
      downloadBlob(blob, `dich-tai-lieu-${pageIndexRef.current + 1}.png`)
    } finally {
      setBusy(false)
    }
  }

  async function savePdf() {
    if (loading) return
    const currentId = pagesRef.current[pageIndexRef.current]?.id
    if (currentId) labelsByPageRef.current.set(currentId, labelsRef.current)
    rememberCurrent()
    setBusy(true)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      for (let index = 0; index < pagesRef.current.length; index += 1) {
        const page = pagesRef.current[index]
        const canvas = await canvasFor(index)
        const baked = bakeLabels(canvas, labelsByPageRef.current.get(page.id) ?? [])
        const bytes = new Uint8Array(await (await canvasPng(baked)).arrayBuffer())
        const png = await doc.embedPng(bytes)
        const pdfPage = doc.addPage([png.width, png.height])
        pdfPage.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height })
      }
      const saved = await doc.save()
      downloadBlob(new Blob([saved.slice().buffer], { type: 'application/pdf' }), 'dich-tai-lieu-da-sua.pdf')
    } catch {
      setError(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  async function canvasFor(index: number): Promise<HTMLCanvasElement> {
    if (index === pageIndexRef.current && viewRef.current && viewRef.current.width > 0) return viewRef.current
    const page = pagesRef.current[index]
    const saved = storeRef.current.get(page.id)
    if (saved) return saved.canvas
    const temp = document.createElement('canvas')
    await paintUrl(temp, page.src)
    return temp
  }

  const tools: Array<{ id: Tool; label: string }> = [
    { id: 'pick', label: copy.pick },
    { id: 'erase', label: copy.erase },
    { id: 'brush', label: copy.brush },
    { id: 'rect', label: copy.rect },
    { id: 'text', label: copy.text },
  ]

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="flex h-[100dvh] w-screen max-w-none flex-col gap-3 overflow-hidden rounded-none p-3 sm:rounded-none"
        onEscapeKeyDown={(event) => {
          if (activeIdRef.current) {
            event.preventDefault()
            finishActive()
          }
        }}
      >
        <DialogHeader className="shrink-0 space-y-1 pr-12 text-left">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.hint}</DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {tools.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={tool === item.id ? 'default' : 'outline'}
              onClick={() => {
                if (toolRef.current === 'text' && item.id !== 'text') finishActive()
                setTool(item.id)
              }}
            >
              {item.label}
            </Button>
          ))}
          <label className="inline-flex items-center gap-1 text-xs">
            <span className="sr-only">{copy.colorLabel}</span>
            <input
              type="color"
              value={color}
              aria-label={copy.colorLabel}
              onChange={(event) => setColor(event.target.value)}
              className="h-8 w-10 cursor-pointer border border-slate-300 bg-white"
            />
          </label>
          {tool === 'erase' ? (
            <label className="inline-flex items-center gap-2 text-xs">
              {copy.tolerance}
              <input type="range" min={0} max={80} value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} />
              <span>{tolerance}</span>
            </label>
          ) : null}
          {tool === 'brush' ? (
            <label className="inline-flex items-center gap-2 text-xs">
              {copy.brushSize}
              <input type="range" min={4} max={120} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            </label>
          ) : null}
          {tool === 'text' ? (
            <>
              <label className="inline-flex items-center gap-2 text-xs">
                {copy.fontSize}
                <input type="range" min={12} max={160} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
              </label>
              <select
                value={fontId}
                onChange={(event) => setFontId(event.target.value)}
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
              >
                {FONTS.map((item) => (
                  <option key={item.id} value={item.id}>{tr(locale, item.vi, item.en, item.zh, item.ja, item.ko)}</option>
                ))}
              </select>
            </>
          ) : null}
          {pages.length > 1 ? (
            <select
              value={pageIndex}
              onChange={(event) => { void showPage(Number(event.target.value)) }}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
            >
              {pages.map((page, index) => (
                <option key={page.id} value={index}>{page.label}</option>
              ))}
            </select>
          ) : null}
          <Button type="button" size="sm" variant="outline" disabled={historyTick >= 0 && undoRef.current.length === 0} onClick={undo}>{copy.undo}</Button>
          <Button type="button" size="sm" variant="outline" disabled={redoRef.current.length === 0} onClick={redo}>{copy.redo}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void reloadPage()}>{copy.reload}</Button>
          <Button type="button" size="sm" disabled={busy || loading} onClick={() => void savePng()}>{busy ? copy.saving : copy.png}</Button>
          {pages.length > 1 ? (
            <Button type="button" size="sm" disabled={busy || loading} onClick={() => void savePdf()}>{copy.pdf}</Button>
          ) : null}
        </div>
        {tool === 'text' ? (
          <div className="flex shrink-0 flex-wrap items-start gap-2">
            <textarea
              ref={textInputRef}
              value={labels.find((item) => item.id === activeId)?.text || ''}
              placeholder={copy.textPlaceholder}
              rows={2}
              autoFocus
              className="min-w-[16rem] flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              onChange={(event) => writeActive(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  finishActive()
                }
              }}
            />
            <Button type="button" size="sm" disabled={!labels.find((item) => item.id === activeId)?.text.trim()} onClick={finishActive}>{copy.place}</Button>
          </div>
        ) : null}
        <div
          className="relative min-h-0 flex-1 overflow-auto rounded-md border border-slate-200"
          style={{ backgroundImage: 'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0' }}
        >
          {loading ? <p className="absolute left-3 top-3 z-10 rounded bg-white/90 px-2 py-1 text-xs">{copy.loading}</p> : null}
          {error ? <p className="absolute left-3 top-3 z-10 rounded bg-white px-2 py-1 text-xs text-red-700">{error}</p> : null}
          <div className="relative w-full">
          <canvas
            ref={viewRef}
            role="img"
            aria-label={copy.title}
            className="block h-auto w-full touch-none"
            style={{ cursor: tool === 'text' ? 'text' : tool === 'pick' ? 'crosshair' : 'cell' }}
            onMouseDown={(event) => {
              if (toolRef.current === 'text') event.preventDefault()
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onContextMenu={(event) => event.preventDefault()}
          />
          {canvasSize.w > 0 && canvasSize.h > 0 ? (
            <div className="pointer-events-none absolute inset-0">
              {labels.map((label) => (
                <div
                  key={label.id}
                  className="pointer-events-auto absolute cursor-grab whitespace-pre-wrap active:cursor-grabbing"
                  style={{
                    left: `${(label.x / canvasSize.w) * 100}%`,
                    top: `${(label.y / canvasSize.h) * 100}%`,
                    maxWidth: Math.max(40, canvasSize.w - label.x - 8) * viewScale,
                    color: label.color,
                    fontFamily: fontFamilyOf(label.fontId),
                    fontSize: label.size * viewScale,
                    lineHeight: 1.25,
                    overflowWrap: 'anywhere',
                    userSelect: 'none',
                    touchAction: 'none',
                  }}
                  onPointerDown={(event) => onLabelPointerDown(event, label.id)}
                >
                  {label.text}
                  {label.id === activeId ? (
                    <span
                      className="inline-block align-text-bottom"
                      style={{
                        width: Math.max(2, Math.round((label.size * viewScale) / 14)),
                        height: label.size * viewScale,
                        background: label.color,
                        marginLeft: 1,
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
