'use client'

import type React from 'react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import {
  BEFORE_AFTER_VIEW_EVENT,
  type BeforeAfterViewMode,
  readBeforeAfterViewMode,
  writeBeforeAfterViewMode,
} from '@/lib/image-tools/before-after-view-preference'
import { cn } from '@/lib/utils'
import { ImagePreview } from '@/components/ui/image-preview'
import { Button } from '@/components/ui/button'
import { GripVertical } from 'lucide-react'

type WebUiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function uiTr(
  locale: WebUiLocale,
  vi: string,
  en: string,
  zh: string,
  ja: string,
  ko: string
): string {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

function useWebUiLocale(): WebUiLocale {
  const [locale, setLocale] = useState<WebUiLocale>('vi')
  useEffect(() => {
    const sync = () => {
      const c = readWebLocaleFromDocumentCookie()
      if (c === 'en' || c === 'zh' || c === 'ja' || c === 'ko') setLocale(c)
      else setLocale('vi')
    }
    sync()
    const t = window.setInterval(sync, 1000)
    window.addEventListener('focus', sync)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('focus', sync)
    }
  }, [])
  return locale
}

function useBeforeAfterViewModeState(): readonly [BeforeAfterViewMode, (m: BeforeAfterViewMode) => void] {
  const [mode, setMode] = useState<BeforeAfterViewMode>('split')
  useEffect(() => {
    setMode(readBeforeAfterViewMode())
    const onEvt = (e: Event) => {
      const ce = e as CustomEvent<{ mode?: BeforeAfterViewMode }>
      if (ce.detail?.mode === 'split' || ce.detail?.mode === 'compare') setMode(ce.detail.mode)
      else setMode(readBeforeAfterViewMode())
    }
    window.addEventListener(BEFORE_AFTER_VIEW_EVENT, onEvt)
    return () => window.removeEventListener(BEFORE_AFTER_VIEW_EVENT, onEvt)
  }, [])
  const persist = useCallback((m: BeforeAfterViewMode) => {
    writeBeforeAfterViewMode(m)
    setMode(m)
  }, [])
  return [mode, persist] as const
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

type ImageCompareSliderProps = {
  beforeSrc: string
  afterSrc: string
  beforeAlt: string
  afterAlt: string
  className?: string
  /** Optional label row above slider */
  labelRow?: React.ReactNode
}

function ImageCompareSlider({ beforeSrc, afterSrc, beforeAlt, afterAlt, className, labelRow }: ImageCompareSliderProps) {
  /** Nền đầy khung: ảnh gốc (before). Kéo sang phải mở rộng lớp clipped: ảnh mới (after) từ mép trái. */
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragLayerRef = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(50)
  const dragging = useRef(false)

  const setFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width <= 0) return
    const next = clamp(((clientX - r.left) / r.width) * 100, 1, 99)
    setPct(next)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    dragLayerRef.current?.setPointerCapture(e.pointerId)
    setFromClientX(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    setFromClientX(e.clientX)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false
    try {
      dragLayerRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* released */
    }
  }

  const onKeyDownRange = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const step = e.shiftKey ? 10 : 5
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPct((p) => clamp(p - step, 1, 99))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPct((p) => clamp(p + step, 1, 99))
    }
  }

  return (
    <div className={cn('space-y-2 w-full', className)}>
      {labelRow}
      <div ref={wrapRef} className="relative w-full max-w-2xl mx-auto aspect-square rounded-lg border overflow-hidden bg-muted/30 touch-none select-none">
        {/* Nền: ảnh gốc */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeSrc}
          alt={beforeAlt}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white/40"
        />
        {/* Lớp phủ trái: ảnh mới (kéo để “mở” kết quả) */}
        <div
          className="absolute inset-y-0 left-0 overflow-hidden z-[1]"
          style={{ width: `${pct}%` }}
          aria-hidden={false}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterSrc}
            alt={afterAlt}
            className="absolute top-0 left-0 h-full w-full object-contain bg-white/40"
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-[3] pointer-events-none"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        />
        <div className="absolute top-1/2 z-[4] pointer-events-none" style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-black/50 text-white shadow">
            <GripVertical className="h-5 w-5" />
          </span>
        </div>
        <div
          ref={dragLayerRef}
          className="absolute inset-0 z-[5] cursor-ew-resize"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="presentation"
        />
      </div>
      <div className="max-w-2xl mx-auto px-1">
        <label className="sr-only" htmlFor="before-after-compare-range">
          Compare
        </label>
        <input
          id="before-after-compare-range"
          type="range"
          min={1}
          max={99}
          value={Math.round(pct)}
          onChange={(e) => setPct(clamp(Number(e.target.value), 1, 99))}
          onKeyDown={onKeyDownRange}
          className="w-full accent-primary h-2 cursor-ew-resize"
        />
      </div>
    </div>
  )
}

export type BeforeAfterResultDisplayProps = {
  beforeSrc: string
  afterSrc: string
  beforeAlt: string
  afterAlt: string
  /** If false, hide compare mode (e.g. multi-image “before”). */
  compareEnabled?: boolean
  className?: string
  /** Heading row: left = before title/actions, right = after title/actions — used in split layout. */
  beforeHeader?: React.ReactNode
  afterHeader?: React.ReactNode
  /** In split mode, extra class on the wrapper around `after` ImagePreview (e.g. checkerboard for PNG). */
  afterPreviewWrapperClassName?: string
  /** className passed to ImagePreview for both panes in split mode. */
  splitImagePreviewClassName?: string
  /** Tỷ lệ in (vd 1:1) — chỉ ảnh «sau» ở chế độ cạnh nhau. */
  afterPrintReadyAspectRatio?: string
  /** Thay `className` khung bọc ảnh «sau» (mặc định có `aspect-square` nếu không truyền class/style tùy chỉnh). */
  splitAfterPaneClassName?: string
  splitAfterPaneStyle?: React.CSSProperties
  /** Khung ảnh «trước» cạnh nhau (khi không dùng customBeforeContent). */
  splitBeforePaneClassName?: string
  /** Optional overlay inside after preview (split only), e.g. try-on metadata. */
  afterPreviewOverlay?: React.ReactNode
  /** Thay cột trái (vd nhiều thumb «trước»). Khi có, không dùng ô vuông đơn ImagePreview bên trái. */
  customBeforeContent?: React.ReactNode
}

/**
 * Trước/Sau theo cấu hình toàn cục (localStorage) hoặc so sánh kéo.
 * Mặc định «Cạnh nhau»; chế độ «Kéo» lưu và dùng chung mọi công cụ ảnh.
 */
export function BeforeAfterResultDisplay({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  compareEnabled = true,
  className,
  beforeHeader,
  afterHeader,
  afterPreviewWrapperClassName,
  splitImagePreviewClassName = 'w-full h-full object-cover',
  afterPrintReadyAspectRatio,
  splitAfterPaneClassName,
  splitAfterPaneStyle,
  splitBeforePaneClassName,
  afterPreviewOverlay,
  customBeforeContent,
}: BeforeAfterResultDisplayProps) {
  const loc = useWebUiLocale()
  const [mode, setMode] = useBeforeAfterViewModeState()

  const labels = useMemo(
    () => ({
      split: uiTr(loc, 'Cạnh nhau', 'Side by side', '并排', '並べて表示', '나란히'),
      compare: uiTr(loc, 'Kéo so sánh', 'Drag to compare', '拖动对比', 'ドラッグで比較', '드래그 비교'),
      help: uiTr(
        loc,
        'Kéo thanh hoặc ảnh để xem ảnh gốc và kết quả.',
        'Drag the slider or image to reveal before and after.',
        '拖动滑块或图片查看前后对比。',
        'スライダーまたは画像をドラッグして前後を比較します。',
        '슬라이더나 영역을 드래그하여 전후를 비교하세요.'
      ),
      prefs: uiTr(loc, 'Đặt làm mặc định', 'Default display', '默认显示设置', '既定の表示', '기본 표시 설정'),
      compareHelpShort: uiTr(
        loc,
        'Trái: ảnh mới · Phải: ảnh gốc (kéo thanh để thay đổi)',
        'Left: new · Right: original — drag to adjust',
        '左：新图 · 右：原图 — 拖动调节',
        '左：新しい画像 · 右：元 — ドラッグで調整',
        '왼쪽: 새 이미지 · 오른쪽: 원본 — 드래그하여 조절'
      ),
    }),
    [loc]
  )

  const showCompare = compareEnabled && mode === 'compare'

  const modeToggle = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 shadow-sm" role="group" aria-label={labels.split}>
        <Button
          type="button"
          size="sm"
          variant={mode === 'split' ? 'default' : 'ghost'}
          className={cn('h-8 px-3 text-xs', mode === 'split' ? '' : 'text-muted-foreground')}
          onClick={() => setMode('split')}
        >
          {labels.split}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'compare' ? 'default' : 'ghost'}
          disabled={!compareEnabled}
          className={cn('h-8 px-3 text-xs', mode === 'compare' ? '' : 'text-muted-foreground')}
          onClick={() => compareEnabled && setMode('compare')}
          title={!compareEnabled ? uiTr(loc, 'Chỉ xem cạnh nhau khi có nhiều ảnh trước.', 'Side-by-side only when there are multiple «before» images.', '多张原图时仅支持并排。', '複数の元画像がある場合は並列のみです。', '원본이 여러 장이면 나란히만 됩니다.') : undefined}
        >
          {labels.compare}
        </Button>
      </div>
      <Link
        href="/cai-dat-hien-thi-ket-qua-anh"
        className="text-xs text-primary hover:underline underline-offset-4"
      >
        {labels.prefs}
      </Link>
    </div>
  )

  if (showCompare) {
    return (
      <div className={cn('space-y-3', className)}>
        {modeToggle}
        <p className="text-xs text-muted-foreground">{labels.help}</p>
        <ImageCompareSlider
          beforeSrc={beforeSrc}
          afterSrc={afterSrc}
          beforeAlt={beforeAlt}
          afterAlt={afterAlt}
          labelRow={
            <div className="flex max-w-2xl mx-auto justify-between text-[10px] text-muted-foreground uppercase tracking-wide px-1">
              <span>{labels.compareHelpShort}</span>
            </div>
          }
        />
        {(beforeHeader || afterHeader) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
            <div className="min-w-0">{beforeHeader}</div>
            <div className="min-w-0">{afterHeader}</div>
          </div>
        )}
      </div>
    )
  }

  const beforePaneClass = cn(
    'rounded-lg border overflow-hidden',
    splitBeforePaneClassName === undefined ? 'aspect-square' : splitBeforePaneClassName
  )

  const afterPaneClass = cn(
    'rounded-lg border overflow-hidden relative',
    splitAfterPaneClassName === undefined && splitAfterPaneStyle === undefined ? 'aspect-square' : null,
    splitAfterPaneClassName,
    afterPreviewWrapperClassName
  )

  // Standard: trái = gốc, phải = kết quả; chế độ kéo: nền gốc, trái mở rộng = kết quả.
  return (
    <div className={cn('space-y-3', className)}>
      {modeToggle}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          {beforeHeader ? <div className="flex items-center justify-between gap-2 min-h-[2rem]">{beforeHeader}</div> : null}
          {customBeforeContent ?? (
            <div className={beforePaneClass}>
              <ImagePreview src={beforeSrc} alt={beforeAlt} className={splitImagePreviewClassName} />
            </div>
          )}
        </div>
        <div className="space-y-2">
          {afterHeader ? (
            <div className="flex items-center justify-between gap-2 min-h-[2rem]">{afterHeader}</div>
          ) : null}
          <div className={afterPaneClass} style={splitAfterPaneStyle}>
            <ImagePreview
              src={afterSrc}
              alt={afterAlt}
              className={splitImagePreviewClassName}
              printReadyAspectRatio={afterPrintReadyAspectRatio}
            />
            {afterPreviewOverlay}
          </div>
        </div>
      </div>
    </div>
  )
}
