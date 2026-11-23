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
import { FigureMenuIcon } from './teacher-whiteboard-figure-icons'

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

function say(tr: Tr, label: FigureLabel) {
  return tr(label[0], label[1], label[2], label[3], label[4])
}

const MENU_GROUPS: Record<FigureSubject, { title: FigureLabel; ids: string[] }[]> = {
  math: [
    { title: ['Đồ thị hàm số', 'Function graphs', '函数图像', '関数のグラフ', '함수 그래프'], ids: ['spatial', 'math-trig'] },
    { title: ['Công thức toán', 'Math formulas', '数学公式', '数学の公式', '수학 공식'], ids: ['math-formula'] },
  ],
  physics: [
    { title: ['Lực, mạch, ánh sáng', 'Force, circuits, light', '力、电路、光', '力・回路・光', '힘·회로·빛'], ids: ['force', 'circuit', 'ray', 'mirror', 'refraction', 'field'] },
    { title: ['Quang học', 'Optics', '光学', '光学', '광학'], ids: ['tir', 'slab', 'eye', 'diffract', 'spectrum', 'young'] },
    { title: ['Đồ thị chuyển động, sóng', 'Motion and wave graphs', '运动与波的图像', '運動・波のグラフ', '운동·파동 그래프'], ids: ['phys-graph', 'wave', 'law-graph'] },
    { title: ['Thí nghiệm và công thức', 'Experiments and formulas', '实验与公式', '実験と公式', '실험과 공식'], ids: ['interfere', 'experiment-phys', 'formula-physics', 'constants'] },
    { title: ['Bàn thí nghiệm', 'Lab bench', '实验台', '実験台', '실험대'], ids: ['standing', 'meters', 'radiation', 'transformer', 'buoyancy', 'photoelectric'] },
  ],
  chemistry: [
    { title: ['Phương trình và cấu tạo', 'Equations and structure', '方程式与结构', '反応式と構造', '반응식과 구조'], ids: ['equation', 'structure', 'atom'] },
    { title: ['Thí nghiệm', 'Lab', '实验', '実験', '실험'], ids: ['glass', 'titration', 'chem-experiment'] },
    { title: ['Bộ thí nghiệm', 'Lab setups', '实验装置', '実験装置', '실험 장치'], ids: ['distill', 'gaslab', 'filter', 'galvanic', 'rate'] },
    { title: ['Tra cứu', 'Reference', '查阅', '資料', '자료'], ids: ['chem-scheme', 'periodic', 'formula-chem'] },
  ],
  biology: [
    { title: ['Tế bào', 'Cells', '细胞', '細胞', '세포'], ids: ['cell', 'division', 'genetic'] },
    { title: ['Di truyền', 'Genetics', '遗传', '遺伝', '유전'], ids: ['pedigree', 'punnett'] },
    { title: ['Quần thể', 'Populations', '种群', '個体群', '개체군'], ids: ['ecology', 'bio-graph', 'formula-bio'] },
    { title: ['Thí nghiệm', 'Experiments', '实验', '実験', '실험'], ids: ['osmosis', 'photo', 'slide', 'blood', 'reflex'] },
  ],
}

const FORMULA_GROUPS: Record<string, { title: FigureLabel; ids: string[] }[]> = {
  'math-formula': [
    { title: ['Đại số', 'Algebra', '代数', '代数', '대수'], ids: ['pythagoras', 'square-sum', 'square-diff', 'diff-squares', 'cube-sum', 'linear', 'quadratic', 'vieta'] },
    { title: ['Lượng giác', 'Trigonometry', '三角', '三角', '삼각'], ids: ['identity', 'sin-sum', 'tan'] },
    { title: ['Diện tích, thể tích, toạ độ', 'Area, volume, coordinates', '面积、体积、坐标', '面積・体積・座標', '넓이·부피·좌표'], ids: ['area', 'tri-area', 'tri-sin', 'trapezoid', 'rect', 'sphere', 'cylinder', 'cone', 'distance', 'slope', 'circle-eq'] },
    { title: ['Dãy, giải tích', 'Sequences, calculus', '数列与微积分', '数列・解析', '수열·미적분'], ids: ['arith', 'geom', 'sum-arith', 'log', 'deriv', 'integral'] },
    { title: ['Xác suất', 'Probability', '概率', '確率', '확률'], ids: ['choose', 'prob'] },
  ],
  'formula-physics': [
    { title: ['Chuyển động', 'Motion', '运动', '運動', '운동'], ids: ['velocity', 'accel', 'motion'] },
    { title: ['Lực, năng lượng', 'Force and energy', '力与能量', '力・エネルギー', '힘·에너지'], ids: ['newton', 'weight', 'momentum', 'work', 'power', 'kinetic', 'potential', 'friction'] },
    { title: ['Công thức điện', 'Electricity formulas', '电学公式', '電気の公式', '전기 공식'], ids: ['ohm', 'series', 'parallel', 'current', 'joule', 'coulomb'] },
    { title: ['Nhiệt, sóng, quang', 'Heat, waves, light', '热、波、光', '熱・波・光', '열·파동·빛'], ids: ['heat', 'wave', 'frequency', 'period', 'lens', 'snell', 'density', 'pressure', 'gas', 'energy', 'efficiency'] },
  ],
  'formula-chem': [
    { title: ['Lượng chất', 'Amount', '物质的量', '物質量', '물질량'], ids: ['mole', 'count', 'volume', 'conc', 'percent', 'convert', 'dilute', 'density', 'yield', 'element'] },
    { title: ['Axit, bazơ', 'Acids and bases', '酸碱', '酸と塩基', '산·염기'], ids: ['ph', 'poh', 'ph-sum', 'kw', 'ka', 'buffer', 'alpha'] },
    { title: ['Phản ứng', 'Reactions', '反应', '反応', '반응'], ids: ['rate', 'kc', 'gas', 'electro', 'titrate'] },
  ],
}

function visibleVariants(item: FigureItem, current: string) {
  return (item.variants ?? []).filter((entry) => entry.menu !== false || entry.id === current)
}

function variantGroups(item: FigureItem, current: string) {
  const choices = visibleVariants(item, current)
  const plan = FORMULA_GROUPS[item.id]
  if (!plan) return [{ title: null as FigureLabel | null, variants: choices }]
  const used = new Set<string>()
  const groups = plan.flatMap((group) => {
    const variants = group.ids.flatMap((id) => {
      const found = choices.find((entry) => entry.id === id)
      if (!found) return []
      used.add(id)
      return [found]
    })
    return variants.length ? [{ title: group.title, variants }] : []
  })
  const rest = choices.filter((entry) => !used.has(entry.id))
  if (rest.length) groups.push({ title: ['Khác', 'Other', '其他', 'その他', '기타'], variants: rest })
  return groups.length ? groups : [{ title: null, variants: choices }]
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
  const pool = FIGURE_ITEMS.filter((item) => item.subject === subject && item.menu !== false)
  const listed = new Set(MENU_GROUPS[subject].flatMap((group) => group.ids))
  const groups = MENU_GROUPS[subject].flatMap((group) => {
    const items = group.ids.flatMap((id) => {
      const found = pool.find((item) => item.id === id)
      return found ? [found] : []
    })
    return items.length ? [{ title: group.title, items }] : []
  })
  const rest = pool.filter((item) => !listed.has(item.id))
  if (rest.length) groups.push({ title: ['Khác', 'Other', '其他', 'その他', '기타'], items: rest })
  const tap = sheet ? 'min-h-10 px-2 py-2 text-[13px]' : 'min-h-8 px-2 py-1.5 text-[12px]'
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
      <div className="shrink-0 border-b border-slate-100 px-2 py-2">
        <div className="grid grid-cols-4 gap-1">
          {FIGURE_SUBJECTS.map((entry) => {
            const on = entry.id === subject
            return (
              <button
                key={entry.id}
                type="button"
                className={cn('min-w-0 rounded-md font-semibold leading-tight', tap, on ? 'text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100')}
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
        <button
          type="button"
          className={cn('mt-1 flex w-full items-center gap-1.5 rounded-md border border-slate-200 text-left font-semibold text-slate-800 hover:bg-sky-50', tap)}
          onClick={onInsertImage}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-sky-700" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.4" fill="currentColor" stroke="none" />
            <path d="M5 16 L10 12 L13 15 L16 12 L19 16" />
          </svg>
          <span>{tr('Chèn ảnh', 'Insert image', '插入图片', '画像を挿入', '이미지 넣기')}</span>
        </button>
      </div>
      {subject === 'math' && showPlot && mathPlot ? (
        <div className="shrink-0 p-2">
          <button type="button" className="mb-1 text-[12px] text-slate-500 hover:text-slate-800" onClick={() => setShowPlot(false)}>
            {tr('Quay lại', 'Back', '返回', '戻る', '뒤로')}
          </button>
          {mathPlot}
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {subject === 'math' && mathPlot ? (
          <button
            type="button"
            className={cn('mt-2 flex w-full items-center gap-1.5 rounded-md bg-sky-600 text-left font-semibold text-white hover:bg-sky-500', tap)}
            onClick={() => setShowPlot(true)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M5 18 V5 M5 18 H20" />
              <path d="M7 15 C10 15 11 8 14 8 C17 8 18 6 20 5" />
            </svg>
            <span>{tr('Vẽ đồ thị', 'Plot a graph', '绘制图像', 'グラフを描く', '그래프 그리기')}</span>
          </button>
        ) : null}
        {groups.map((group) => (
          <div key={group.title[0]}>
            <p className="px-0.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{say(tr, group.title)}</p>
            <div className="grid grid-cols-2 gap-1">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn('flex items-start gap-1.5 rounded-md border border-slate-200 text-left leading-tight text-slate-800 hover:border-sky-300 hover:bg-sky-50', tap)}
                  onClick={() => onPick(item.id)}
                >
                  <FigureMenuIcon id={item.id} />
                  <span className="min-w-0 flex-1">{say(tr, item.label)}</span>
                </button>
              ))}
            </div>
          </div>
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
                ? tr('Dụng cụ thuỷ tinh', 'Glassware', '玻璃器具', 'ガラス器具', '유리 기구')
                : tr('Nội dung hình', 'What to draw', '图的内容', '図の内容', '그림 내용')}
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
                {variantGroups(item, params.variant).map((group) => {
                  const options = group.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>{say(tr, variant.label)}</option>
                  ))
                  if (!group.title) return options
                  return (
                    <optgroup key={group.title[0]} label={say(tr, group.title)}>
                      {options}
                    </optgroup>
                  )
                })}
              </select>
            </label>
          ) : null}
          {item.fields.includes('equation') ? (
            <label className="mt-2 block text-[11px] font-medium">
              {tr('Phương trình phản ứng', 'Reaction equation', '反应方程式', '反応式', '반응식')}
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
