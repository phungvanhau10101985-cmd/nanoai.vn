'use client'

import { useMemo, useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

export type AnswerTypingPositionPopoverProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nút vừa bấm — popover neo theo vị trí nút (cập nhật khi scroll/resize). */
  anchorRef: React.RefObject<HTMLElement | null>
  /** Tổng segment trên toàn slide (mọi block gõ, theo thứ tự trên → dưới). */
  totalSegments: number
  draft: number
  onDraftChange: (segments: number) => void
  disabled?: boolean
  onApply: (segments: number) => void
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
}

export function AnswerTypingPositionPopover({
  open,
  onOpenChange,
  anchorRef,
  totalSegments,
  draft,
  onDraftChange,
  disabled,
  onApply,
  tr,
}: AnswerTypingPositionPopoverProps) {
  const max = Math.max(0, totalSegments)
  const clamp = (n: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)))

  /** Đếm scroll/resize để đọc lại getBoundingClientRect (không gọi trong render thuần). */
  const [layoutTick, setLayoutTick] = useState(0)

  useEffect(() => {
    if (!open) return
    const bump = () => setLayoutTick((t) => t + 1)
    window.addEventListener('scroll', bump, true)
    window.addEventListener('resize', bump)
    return () => {
      window.removeEventListener('scroll', bump, true)
      window.removeEventListener('resize', bump)
    }
  }, [open])

  const anchorBox = useMemo(() => {
    void layoutTick
    if (!open) return null
    const el = anchorRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      top: r.top,
      left: r.left,
      width: Math.max(1, r.width),
      height: Math.max(1, r.height),
    }
  }, [open, anchorRef, layoutTick])

  const applyDraft = () => {
    onApply(clamp(draft))
    onOpenChange(false)
  }

  if (max <= 0) return null

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      {anchorBox ? (
        <PopoverAnchor asChild>
          <div
            style={{
              position: 'fixed',
              top: anchorBox.top,
              left: anchorBox.left,
              width: anchorBox.width,
              height: anchorBox.height,
              pointerEvents: 'none',
            }}
            aria-hidden
          />
        </PopoverAnchor>
      ) : null}
      {/* Luôn phía trên nút: avoidCollisions=false tắt flip của Radix (không lật xuống đè slide). */}
      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        avoidCollisions={false}
        className="z-[500] w-[min(100vw-1.5rem,20rem)] border-slate-600 bg-slate-900 p-0 text-slate-200 shadow-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative max-h-[min(75vh,22rem)] overflow-y-auto overflow-x-hidden p-3 pt-3">
          <button
            type="button"
            className="absolute right-2 top-2 rounded-sm p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
          <p className="mb-1.5 pr-7 text-[11px] font-medium leading-snug text-amber-200/90">
            {tr(
              'Gõ đã tạm dừng. Kéo thanh — màu chữ trên lời giải đổi theo.',
              'Typing is paused. Drag the slider — answer colors update live.',
              '已暂停打字。拖动滑块 — 文字颜色随之变化。',
              '入力を一時停止しました。スライダーで文字色が変わります。',
              '입력이 일시정지되었습니다. 슬라이더로 글자색이 바뀝니다.'
            )}
          </p>
          <p className="mb-2 text-[10px] leading-snug text-slate-500">
            {tr(
              'Thanh áp dụng cho toàn bộ slide: các khối gõ được đổ đầy lần lượt từ trên xuống.',
              'The slider covers the whole slide: typed blocks fill in order from top to bottom.',
              '滑块作用于整页：打字块从上到下依次填满。',
              'スライダーはスライド全体。上から順にブロックが埋まります。',
              '슬라이더는 슬라이드 전체입니다. 위에서 아래로 블록이 채워집니다.'
            )}
          </p>
          <p className="mb-2 text-[11px] leading-snug text-slate-400">
            {tr(
              'Số segment đã hiện cho học sinh (gõ tiếp từ đoạn sau).',
              'How many segments are already shown (typing continues after this).',
              '已显示给学生多少段（之后继续打字）。',
              '生徒に既に表示したセグメント数（この後から続けて入力）。',
              '학생에게 이미 보인 세그먼트 수(이후부터 이어서 입력).'
            )}
          </p>
          <div className="mb-2 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={clamp(draft)}
              onChange={(e) => onDraftChange(Number(e.target.value))}
              className="min-w-0 flex-1 cursor-pointer accent-amber-400 disabled:opacity-40"
              disabled={disabled}
              aria-label={tr('Tiến độ segment', 'Segment progress', '段进度', 'セグメント', '세그먼트')}
            />
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-300">
              {clamp(draft)}/{max}
            </span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={max}
              step={1}
              value={draft}
              onChange={(e) => onDraftChange(clamp(Number(e.target.value)))}
              className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs tabular-nums text-slate-100 disabled:opacity-40"
              disabled={disabled}
              aria-label={tr('Nhập segment', 'Segment number', '段数', 'セグメント数', '세그먼트')}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDraftChange(0)}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-600 disabled:opacity-40"
            >
              {tr('Từ đầu', 'Start', '从头', '先頭', '처음')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDraftChange(max)}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-600 disabled:opacity-40"
            >
              {tr('Hết (đã gõ xong)', 'End (done)', '结束', '末尾', '끝')}
            </button>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={applyDraft}
            className="w-full rounded-md border border-amber-500/40 bg-amber-500/25 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/35 disabled:opacity-40"
          >
            {tr('Áp dụng & đồng bộ HS', 'Apply & sync', '应用并同步', '適用して同期', '적용·동기화')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
