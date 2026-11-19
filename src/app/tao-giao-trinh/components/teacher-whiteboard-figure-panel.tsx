'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { keepEntryFieldInCard, useMobileVisibleFrame } from './use-mobile-visible-frame'
import {
  FIGURE_ITEMS,
  FIGURE_SUBJECTS,
  drawFigureLocal,
  figureItem,
  type FigureItem,
  type FigureLabel,
  type FigureParams,
  type FigureSubject,
} from '../lib/teacher-whiteboard/figures'
import { parsePlotInput, parseSpatialInput, samplePlot, formatAxisNumber, axisTickStep } from '../lib/teacher-whiteboard/plot'

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

function say(tr: Tr, label: FigureLabel) {
  return tr(label[0], label[1], label[2], label[3], label[4])
}

export function FigurePreview({ item, params }: { item: FigureItem; params: FigureParams }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = 280
    const h = 220
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, w, h)
    const pad = 10
    const scale = Math.min((w - pad * 2) / item.w, (h - pad * 2) / item.h)
    ctx.save()
    ctx.translate((w - item.w * scale) / 2, (h - item.h * scale) / 2)
    ctx.scale(scale, scale)
    drawFigureLocal(ctx, item.id, params, item.w, item.h)
    ctx.restore()
  }, [item, params])
  return <canvas ref={ref} width={280} height={220} className="h-[220px] w-[280px] rounded-xl border border-slate-200 bg-slate-50 max-md:h-36 max-md:w-full" />
}

export type GraphPreviewCurve = { expr: string; color: string }

export function GraphPreview({
  expr,
  color,
  shared,
  empty,
}: {
  expr: string
  color: string
  shared: GraphPreviewCurve[]
  empty: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const sharedKey = shared.map((curve) => `${curve.color}|${curve.expr}`).join('\n')
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const paint = () => {
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(180, Math.round(canvas.clientWidth || 240))
      const h = Math.max(140, Math.round(canvas.clientHeight || 168))
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)
      const spatial = parseSpatialInput(expr)
      if (spatial) {
        drawFigureLocal(ctx, 'spatial', { variant: 'paraboloid', liquid: '#7dd3fc', level: 0, label: '', equation: spatial, tune: [], run: false, clock: 0, shift: 0 }, w, h, 0.6)
        return
      }
      const curves = [
        ...shared.map((curve) => ({ ...curve, draft: false })),
        { expr, color, draft: true },
      ]
      const parsed = curves.flatMap((curve) => {
        const plot = parsePlotInput(curve.expr)
        return plot ? [{ plot, color: curve.color }] : []
      })
      if (!parsed.length) {
        ctx.fillStyle = '#64748b'
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(empty, w / 2, h / 2)
        return
      }
      const span = 4
      const left = 36
      const right = 18
      const top = 16
      const bottom = 22
      const unit = Math.min((w - left - right) / (span * 2), (h - top - bottom) / (span * 2))
      const ox = left + span * unit
      const oy = top + span * unit
      const X = (x: number) => ox + x * unit
      const Y = (y: number) => oy - y * unit
      ctx.strokeStyle = '#334155'
      ctx.fillStyle = '#334155'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(X(-span), oy)
      ctx.lineTo(X(span) + 10, oy)
      ctx.moveTo(ox, Y(-span))
      ctx.lineTo(ox, Y(span) - 10)
      ctx.stroke()
      const arrow = (x: number, y: number, dx: number, dy: number) => {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - dx * 8 - dy * 4, y - dy * 8 + dx * 4)
        ctx.lineTo(x - dx * 8 + dy * 4, y - dy * 8 - dx * 4)
        ctx.closePath()
        ctx.fill()
      }
      arrow(X(span) + 10, oy, 1, 0)
      arrow(ox, Y(span) - 10, 0, -1)
      const step = axisTickStep(unit)
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
      ctx.lineWidth = 1
      for (let n = -span; n <= span + 1e-6; n += step) {
        if (Math.abs(n) < 1e-6) continue
        ctx.beginPath()
        ctx.moveTo(X(n), oy - 3)
        ctx.lineTo(X(n), oy + 3)
        ctx.moveTo(ox - 3, Y(n))
        ctx.lineTo(ox + 3, Y(n))
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(formatAxisNumber(n), X(n), oy + 4)
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(formatAxisNumber(n), ox - 5, Y(n))
      }
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText('0', ox - 5, oy + 4)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText('x', X(span) + 2, oy - 8)
      ctx.fillText('y', ox + 6, Y(span) - 2)
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      for (const curve of parsed) {
        const pts = samplePlot(curve.plot, -span, span, 200)
        ctx.strokeStyle = curve.color || '#2563eb'
        ctx.beginPath()
        let drawing = false
        let prev = pts[0]
        for (const p of pts) {
          const inside = Math.abs(p.x) <= span && Math.abs(p.y) <= span
          const prevInside = prev ? Math.abs(prev.x) <= span && Math.abs(prev.y) <= span : false
          const jump = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) > span : false
          if (inside && prevInside && !jump) ctx.lineTo(X(p.x), Y(p.y))
          else if (inside) ctx.moveTo(X(p.x), Y(p.y))
          drawing = inside
          prev = p
          if (!drawing) continue
        }
        ctx.stroke()
      }
    }
    paint()
    const watch = new ResizeObserver(() => paint())
    watch.observe(canvas)
    return () => watch.disconnect()
  }, [expr, color, empty, sharedKey])
  return <canvas ref={ref} className="h-full min-h-[168px] w-full rounded-lg border border-slate-200 bg-slate-50" />
}

export function FigureMenu({ tr, onPick, onInsertImage, mathPlot, sheet = false }: { tr: Tr; onPick: (id: string) => void; onInsertImage: () => void; mathPlot?: ReactNode; sheet?: boolean }) {
  const [subject, setSubject] = useState<FigureSubject>('math')
  const boxRef = useRef<HTMLDivElement>(null)
  const [maxH, setMaxH] = useState(320)
  const [nudge, setNudge] = useState(0)
  const [showPlot, setShowPlot] = useState(false)
  useEffect(() => {
    if (sheet) return
    const el = boxRef.current
    if (!el) return
    const fit = () => {
      const board = el.closest('[data-teacher-whiteboard]')
      const clip = board?.querySelector(':scope > .overflow-hidden')
      const bounds = (clip ?? board ?? document.documentElement).getBoundingClientRect()
      const bottom = el.getBoundingClientRect().bottom
      const top = bounds.top
      setMaxH(Math.max(180, Math.floor(bottom - top - 8)))
      const rect = el.getBoundingClientRect()
      const naturalLeft = rect.left - nudge
      const naturalRight = rect.right - nudge
      let next = 0
      if (naturalLeft < bounds.left + 12) next = bounds.left + 12 - naturalLeft
      if (naturalRight + next > bounds.right - 12) next -= naturalRight + next - (bounds.right - 12)
      if (Math.abs(next - nudge) > 1) setNudge(next)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [nudge, subject, showPlot, sheet])
  const items = FIGURE_ITEMS.filter((item) => item.subject === subject && item.menu !== false)
  return (
    <div
      ref={boxRef}
      style={sheet ? undefined : { maxHeight: maxH, transform: `translateX(calc(-50% + ${nudge}px))` }}
      className={cn(
        'flex flex-col overflow-hidden bg-white text-slate-900',
        sheet
          ? 'max-h-full w-full'
          : cn(
            'absolute bottom-full left-1/2 z-40 mb-1 rounded-xl border border-slate-200 shadow-xl',
            subject === 'math' && showPlot && mathPlot ? 'w-[min(560px,calc(100vw-1.5rem))]' : 'w-[min(420px,calc(100vw-1.5rem))]',
          ),
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="grid shrink-0 grid-cols-5 gap-1 border-b border-slate-100 px-1 py-1">
        <button
          type="button"
          className="min-w-0 rounded border border-slate-200 px-0.5 py-1 text-[11px] font-semibold leading-tight text-slate-700 hover:bg-sky-50 max-md:py-1.5 max-md:text-[12px]"
          onClick={onInsertImage}
        >
          {tr('Chèn ảnh', 'Image', '图片', '画像', '이미지')}
        </button>
        {FIGURE_SUBJECTS.map((entry) => {
          const on = entry.id === subject
          return (
            <button
              key={entry.id}
              type="button"
              className={cn(
                'min-w-0 rounded border px-0.5 py-1 text-[11px] font-semibold leading-tight max-md:py-1.5 max-md:text-[12px]',
                on ? 'border-transparent text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50',
              )}
              style={on ? { backgroundColor: entry.color } : undefined}
              onClick={() => {
                setSubject(entry.id)
                setShowPlot(false)
              }}
            >
              {say(tr, entry.label)}
            </button>
          )
        })}
      </div>
      {subject === 'math' && showPlot && mathPlot ? (
        <div className="shrink-0 p-2">
          <button type="button" className="mb-1 text-[12px] text-slate-500 hover:text-slate-800" onClick={() => setShowPlot(false)}>
            {tr('Quay lại', 'Back', '返回', '戻る', '뒤로')}
          </button>
          {mathPlot}
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {subject === 'math' && mathPlot ? (
          <button
            type="button"
            className="block w-full rounded px-3 py-1 text-left text-[13px] text-slate-800 hover:bg-sky-50 max-md:py-2"
          >
            {tr('Vẽ đồ thị', 'Plot a graph', '绘制图像', 'グラフを描く', '그래프 그리기')}
          </button>
        ) : null}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="block w-full rounded px-3 py-1 text-left text-[13px] text-slate-800 hover:bg-sky-50 max-md:py-2"
          >
            {say(tr, item.label)}
          </button>
        ))}
      </div>
      )}
    </div>
  )
}

export function FigureEditor({
  tr,
  itemId,
  params,
  onParams,
  onInsert,
  onClose,
}: {
  tr: Tr
  itemId: string
  params: FigureParams
  onParams: (next: FigureParams) => void
  onInsert: () => void
  onClose: () => void
}) {
  const item = figureItem(itemId)
  const visibleFrame = useMobileVisibleFrame()
  if (!item) return null
  const pinned = visibleFrame.narrow
    ? {
        position: 'fixed' as const,
        left: 8,
        right: 8,
        top: visibleFrame.top + 8,
        width: 'auto' as const,
        maxHeight: Math.max(180, visibleFrame.height - 16),
        zIndex: 80,
      }
    : undefined
  return (
    <div
      data-wb-entry
      className="pointer-events-auto absolute bottom-24 left-3 z-40 w-[min(640px,calc(100%-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl"
      style={pinned}
      onPointerDown={(event) => event.stopPropagation()}
      onFocusCapture={(event) => {
        const field = event.target
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
          keepEntryFieldInCard({ currentTarget: field })
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{say(tr, item.label)}</p>
        <button type="button" className="text-[12px] text-slate-500" onClick={onClose}>
          {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-3 max-md:flex-col">
        <div className="min-w-[220px] flex-1 max-md:min-w-0 max-md:w-full">
          {item.variants ? (
            <label className="block text-[11px] font-medium">
              {item.id === 'glass'
                ? tr('Dụng cụ', 'Apparatus', '器具', '器具', '기구')
                : tr('Loại', 'Type', '类型', '種類', '종류')}
              <select
                className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                value={params.variant}
                onChange={(event) => {
                  const variant = item.variants?.find((entry) => entry.id === event.target.value)
                  onParams({
                    ...params,
                    variant: event.target.value,
                    equation: variant?.sample ?? params.equation,
                  })
                }}
              >
                {item.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>{say(tr, variant.label)}</option>
                ))}
              </select>
            </label>
          ) : null}
          {item.fields.includes('equation') ? (
            <label className="mt-2 block text-[11px] font-medium">
              {tr('Phương trình', 'Equation', '方程式', '反応式', '반응식')}
              <input
                value={params.equation}
                onChange={(event) => onParams({ ...params, equation: event.target.value })}
                className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                placeholder="H2 + O2 -> H2O"
              />
            </label>
          ) : null}
          {item.fields.includes('liquid') ? (
            <label className="mt-2 flex items-center gap-2 text-[11px] font-medium">
              {tr('Màu chất lỏng', 'Liquid color', '液体颜色', '液体の色', '액체 색')}
              <input
                type="color"
                value={params.liquid}
                onChange={(event) => onParams({ ...params, liquid: event.target.value })}
                className="h-7 w-10 cursor-pointer rounded border border-slate-300 bg-white"
              />
            </label>
          ) : null}
          {item.fields.includes('level') ? (
            <label className="mt-2 block text-[11px] font-medium">
              {tr('Mức chất lỏng (%)', 'Liquid level (%)', '液位 (%)', '液面 (%)', '액체 높이 (%)')}
              <input
                type="number"
                min={0}
                max={100}
                value={params.level}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  onParams({ ...params, level: Number.isFinite(next) ? next : 0 })
                }}
                className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
              />
            </label>
          ) : null}
          {item.fields.includes('label') ? (
            <label className="mt-2 block text-[11px] font-medium">
              {item.id === 'periodic'
                ? tr('Tô đậm nguyên tố', 'Highlight element', '高亮元素', '元素を強調', '원소 강조')
                : tr('Nhãn', 'Label', '标签', 'ラベル', '이름')}
              <input
                value={params.label}
                onChange={(event) => onParams({ ...params, label: event.target.value })}
                className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                placeholder={item.id === 'periodic' ? 'Na' : 'CO2'}
              />
            </label>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            {tr(
              'Xem hình tóm tắt bên cạnh. Bấm Chèn để đưa lên bảng.',
              'Check the summary drawing, then insert it on the board.',
              '先看右侧简图，再插入白板。',
              '右の図を見てからボードに挿入。',
              '오른쪽 그림을 본 뒤 판에 넣습니다.',
            )}
          </p>
          <button type="button" className={cn('mt-2 rounded bg-sky-600 px-3 py-1.5 text-[12px] font-medium text-white')} onClick={onInsert}>
            {tr('Chèn vào bảng', 'Insert on the board', '插入白板', 'ボードに挿入', '판에 넣기')}
          </button>
        </div>
        <FigurePreview item={item} params={params} />
      </div>
    </div>
  )
}
