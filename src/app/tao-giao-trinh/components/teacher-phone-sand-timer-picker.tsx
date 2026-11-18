'use client'

import { useState } from 'react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const PRESET_MINUTES = [1, 3, 5, 10] as const

function parseCustomMinutes(raw: string): number | null {
  const value = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(value) || value < 1 || value > 120) return null
  return value
}

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

function formatElapsed(seconds: number): string {
  const mm = Math.floor(Math.max(0, seconds) / 60)
  const ss = (Math.max(0, seconds) % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export function TeacherPhoneSandTimerPicker({
  elapsedSeconds,
  elapsedRunning,
  onElapsedStart,
  onElapsedStop,
  onElapsedReset,
  onStartMinutes,
  tr,
}: {
  elapsedSeconds: number
  elapsedRunning: boolean
  onElapsedStart: () => void
  onElapsedStop: () => void
  onElapsedReset: () => void
  onStartMinutes: (minutes: number) => void
  tr: Tr
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const customMinutes = parseCustomMinutes(custom)

  const startMinutes = (minutes: number) => {
    onStartMinutes(minutes)
    setCustom('')
    setOpen(false)
  }

  const iconBtn = 'flex h-7 w-7 items-center justify-center rounded-md text-emerald-200 active:bg-emerald-500/25'

  return (
    <>
      <div className="inline-flex h-7 shrink-0 items-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 pl-1.5 pr-0.5">
        <span className="min-w-[2.4rem] px-0.5 text-center font-mono text-[11px] font-semibold text-emerald-300">
          {formatElapsed(elapsedSeconds)}
        </span>
        <button
          type="button"
          className={iconBtn}
          onClick={elapsedRunning ? onElapsedStop : onElapsedStart}
          title={elapsedRunning ? tr('Tạm dừng', 'Pause', '暂停', '一時停止', '일시정지') : tr('Bắt đầu', 'Start', '开始', '開始', '시작')}
        >
          {elapsedRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          className={iconBtn}
          onClick={onElapsedReset}
          title={tr('Đặt lại', 'Reset', '重置', 'リセット', '초기화')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-500/20 px-2 text-[11px] font-medium text-amber-100"
        title={tr('Chọn thời gian đồng hồ cát', 'Choose sand timer', '选择沙漏时间', '砂時計の時間を選ぶ', '모래시계 시간 선택')}
      >
        <Timer className="h-3.5 w-3.5" />
        {tr('phút', 'min', '分', '分', '분')}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[80] max-w-[min(calc(100vw-1.5rem),20rem)] rounded-2xl border-slate-600 bg-slate-950 p-4 text-white">
          <DialogHeader>
            <DialogTitle className="text-base text-amber-100">
              {tr('Chọn thời gian', 'Choose time', '选择时间', '時間を選ぶ', '시간 선택')}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {tr(
                'Bấm số có sẵn thì chạy ngay. Gõ số rồi bấm OK.',
                'Tap a preset to start now. Type a number, then OK.',
                '点预设立即开始。输入数字后按确定。',
                '用意の数字を押すとすぐ開始。入力したらOK。',
                '숫자를 누르면 바로 시작. 직접 입력하면 OK.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_MINUTES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => startMinutes(minutes)}
                className="h-12 rounded-xl border border-amber-400/40 bg-amber-500/15 text-lg font-semibold text-amber-100 active:bg-amber-500/30"
              >
                {minutes}{tr(' phút', ' min', ' 分', ' 分', '분')}
              </button>
            ))}
          </div>
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (customMinutes == null) return
              startMinutes(customMinutes)
            }}
          >
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={tr('Số phút', 'Minutes', '分钟', '分', '분')}
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={customMinutes == null}
              className={cn(
                'h-11 shrink-0 rounded-xl px-4 text-sm font-semibold',
                customMinutes == null
                  ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                  : 'bg-amber-500 text-slate-950'
              )}
            >
              {tr('OK', 'OK', '确定', 'OK', '확인')}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
