'use client'

import { useState, type MouseEvent } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const PRESET_SECONDS = [1, 2, 3, 4, 5] as const

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

export function TeacherPhoneAutoPlayPicker({
  running,
  intervalSeconds,
  onStartSeconds,
  onStop,
  tr,
  className,
  ignoreClick,
}: {
  running: boolean
  intervalSeconds: number
  onStartSeconds: (seconds: number) => void
  onStop: () => void
  tr: Tr
  className?: string
  ignoreClick?: (e: MouseEvent) => boolean
}) {
  const [open, setOpen] = useState(false)
  const seconds = Math.max(1, Math.round(intervalSeconds))
  const stopLabel = `${tr('Dừng', 'Stop', '停止', '停止', '중지')}-${seconds}s`

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={(e) => {
          if (ignoreClick?.(e)) return
          if (running) {
            onStop()
            return
          }
          setOpen(true)
        }}
      >
        {running ? stopLabel : tr('Tự chạy', 'Auto', '自动', '自動', '자동')}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[80] max-w-[min(calc(100vw-1.5rem),20rem)] rounded-2xl border-slate-600 bg-slate-950 p-4 text-white">
          <DialogHeader>
            <DialogTitle className="text-base text-amber-100">
              {tr('Chọn số giây', 'Choose seconds', '选择秒数', '秒数を選ぶ', '초 선택')}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {tr(
                'Bấm số giây thì tự chạy luôn.',
                'Tap a number to start autoplay now.',
                '点秒数即开始自动播放。',
                '秒数を押すとすぐ自動再生。',
                '초를 누르면 바로 자동 재생.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_SECONDS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => {
                  onStartSeconds(seconds)
                  setOpen(false)
                }}
                className={cn(
                  'h-12 rounded-xl border border-amber-400/40 bg-amber-500/15 text-lg font-semibold text-amber-100 active:bg-amber-500/30'
                )}
              >
                {seconds}s
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
