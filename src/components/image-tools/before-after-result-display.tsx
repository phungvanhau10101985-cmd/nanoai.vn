'use client'

import type React from 'react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { CompareSlider } from '@/components/ui/compare-slider'

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
  const [mode, setMode] = useState<BeforeAfterViewMode>(() => readBeforeAfterViewMode())
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
 * Trước/Sau: chế độ «Kéo so sánh» dùng cùng `CompareSlider` như Thiết kế nội ngoại thất; «Cạnh nhau» tùy chọn.
 * Mặc định mở chế độ kéo (lưu trong localStorage; có thể đổi tại /cai-dat-hien-thi-ket-qua-anh).
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
        'Trái: ảnh gốc · Phải: kết quả — kéo thanh giữa để so sánh (giống Thiết kế nội ngoại thất).',
        'Left: original · Right: result — drag the handle to compare (same as interior/exterior design).',
        '左：原图 · 右：结果 — 拖动中间滑块对比（与室内设计工具相同）。',
        '左：元 · 右：結果 — 中央をドラッグして比較（内装ツールと同じ）。',
        '왼쪽: 원본 · 오른쪽: 결과 — 손잡이를 드래그해 비교(인테리어 도구와 동일).'
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
        <p className="text-[11px] text-muted-foreground max-w-3xl mx-auto px-1">{labels.compareHelpShort}</p>
        <CompareSlider
          before={beforeSrc}
          after={afterSrc}
          className="max-h-[min(70vh,520px)] w-full max-w-3xl mx-auto"
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

  // Chế độ cạnh nhau: trái = ảnh gốc, phải = kết quả (chế độ kéo dùng `CompareSlider`).
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
