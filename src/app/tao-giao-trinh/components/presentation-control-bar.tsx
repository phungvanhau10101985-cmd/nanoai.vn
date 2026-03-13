'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, X, Printer, BarChart2, Play, Pause, Settings2, PenLine, Timer, RotateCcw, Presentation, Square, LayoutGrid, Monitor, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** Các mốc thời gian đồng hồ cát (giây) – dùng hằng để tránh lỗi .map trong JSX */
const SANDS_SECONDS = [60, 180, 300, 600] as const

/** Layout chuẩn – mobile: wrap, desktop: flex-nowrap. Desktop giữ nguyên. */
const SHARED_LAYOUT = {
  container: 'flex items-center justify-between px-3 md:px-6 landscape:px-6 py-2 md:py-3 landscape:py-3 gap-2 md:gap-4 landscape:gap-4 flex-wrap md:flex-nowrap landscape:flex-nowrap',
  leftIndex: 'text-sm font-medium tabular-nums min-w-[3rem] shrink-0',
  rightGroup: 'flex items-center gap-2 flex-nowrap shrink-0',
  /** Đồng hồ giáo viên – khung cố định */
  teacherTimer: 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0',
  /** Nút Chèn – kích thước cố định */
  btnInsert: 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium shrink-0 h-9',
  /** Nút Viết */
  btnWrite: 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium shrink-0 h-9',
  /** Select tốc độ gõ */
  selectSpeed: 'w-[70px] h-9 shrink-0',
  /** Nút Tự chạy */
  btnAutoPlay: 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium shrink-0 h-9',
  /** Select interval */
  selectInterval: 'w-[72px] h-9 shrink-0',
  /** Khung đồng hồ cát */
  sandTimer: 'flex items-center gap-1.5 border rounded-lg px-2 py-1 shrink-0',
  /** Nút prev/next */
  btnNav: 'p-2 rounded-lg shrink-0 h-9 w-9 flex items-center justify-center',
  /** Nút icon (Print, Close, Xem học sinh) */
  btnIcon: 'p-2 rounded-lg shrink-0 h-9 w-9 flex items-center justify-center',
} as const

export type PresentationControlBarVariant = 'student' | 'teacher'

export interface PresentationControlBarProps {
  variant: PresentationControlBarVariant
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  /** Slide index hiện tại */
  currentIndex: number
  totalSlides: number
  /** Đồng hồ giáo viên */
  teacherTimerSeconds: number
  teacherTimerRunning: boolean
  onTeacherTimerStart?: () => void
  onTeacherTimerStop?: () => void
  onTeacherTimerReset?: () => void
  /** Student: chỉ hiển thị (nhận từ giáo viên). Teacher: có nút bấm */
  teacherTimerInteractive?: boolean
  /** Chèn – chỉ hiện khi curriculumId */
  curriculumId?: string | null
  onInsertClick?: () => void
  /** Viết */
  writingMode: boolean
  onWritingModeToggle: () => void
  writingSpeedMs: number
  onWritingSpeedChange: (ms: number) => void
  /** Tự chạy */
  autoPlay: boolean
  onAutoPlayToggle: () => void
  autoPlayIntervalMs: number
  onAutoPlayIntervalChange: (ms: number) => void
  /** Đồng hồ cát – student: interactive, teacher: gửi lệnh */
  sandTimerSeconds: number
  sandTimerRunning: boolean
  onSandTimerStart?: (seconds: number) => void
  onSandTimerToggle?: () => void
  onSandTimerReset?: () => void
  /** Navigation */
  onPrev: () => void
  onNext: () => void
  /** Student: Print, Close, Share (link + QR). Teacher: 1/3 mode, Xem học sinh */
  onPrint?: () => void
  onClose?: () => void
  onShareClick?: () => void
  /** Khi true: nút Chia sẻ vẫn click được dù parent có pointer-events-none (chế độ slide-interaction) */
  shareButtonClickableWhenParentDisabled?: boolean
  slideViewMode?: 'single' | 'triple'
  onSlideViewModeChange?: (mode: 'single' | 'triple') => void
  onOpenStudentView?: () => void
  /** Chia sẻ màn hình (tab) – học sinh xem stream có bản đồ + chuột thật */
  onScreenShareStart?: () => void
  onScreenShareStop?: () => void
  isScreenSharing?: boolean
  /** Highlight control từ chuột ảo (mirror mode) */
  highlightedControl?: string | null
  /** Ẩn riêng từng control cho các biến thể đặc biệt */
  hideTeacherTimer?: boolean
  hideInsert?: boolean
  /** Ẩn số slide (dùng khi hiển thị ở header) */
  hideIndex?: boolean
  /** Ẩn toàn bộ (print) */
  printHidden?: boolean
}

export function PresentationControlBar({
  variant,
  tr,
  currentIndex,
  totalSlides,
  teacherTimerSeconds,
  teacherTimerRunning,
  onTeacherTimerStart,
  onTeacherTimerStop,
  onTeacherTimerReset,
  teacherTimerInteractive = false,
  curriculumId,
  onInsertClick,
  writingMode,
  onWritingModeToggle,
  writingSpeedMs,
  onWritingSpeedChange,
  autoPlay,
  onAutoPlayToggle,
  autoPlayIntervalMs,
  onAutoPlayIntervalChange,
  sandTimerSeconds,
  sandTimerRunning,
  onSandTimerStart,
  onSandTimerToggle,
  onSandTimerReset,
  onPrev,
  onNext,
  onPrint,
  onClose,
  onShareClick,
  shareButtonClickableWhenParentDisabled = false,
  slideViewMode,
  onSlideViewModeChange,
  onOpenStudentView,
  onScreenShareStart,
  onScreenShareStop,
  isScreenSharing = false,
  highlightedControl,
  hideTeacherTimer = false,
  hideInsert = false,
  hideIndex = false,
  printHidden = false,
}: PresentationControlBarProps) {
  const isStudent = variant === 'student'
  const isTeacher = variant === 'teacher'

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const studentTheme = {
    text: 'text-white/90',
    index: 'text-white/90',
    teacherTimerBg: 'bg-emerald-500/15 border-emerald-400/30',
    teacherTimerText: 'text-emerald-400/90 text-emerald-300',
    btnBase: 'text-white hover:bg-white/20 border-white/30',
    btnActive: 'bg-white/20 border-white/50',
    btnInactive: 'bg-slate-600/50 border-slate-500/50 text-slate-200 hover:bg-slate-600/70',
    sandTimerBorder: 'border-amber-400/50',
    sandTimerText: 'text-amber-400 text-slate-200',
    sandTimerBg: 'hover:bg-amber-500/30',
    navBtn: 'bg-slate-700/80 hover:bg-slate-600 text-white',
  }

  const teacherTheme = {
    text: 'text-slate-300',
    index: 'text-slate-300',
    teacherTimerBg: 'bg-emerald-500/15 border-emerald-400/30',
    teacherTimerText: 'text-emerald-400/90 text-emerald-300',
    btnBase: 'text-slate-200 hover:bg-slate-600/70',
    btnActive: 'bg-white/20 border-white/50 text-white',
    btnInactive: 'bg-slate-600/50 border-slate-500/50 text-slate-200 hover:bg-slate-600/70',
    sandTimerBorder: 'border-amber-400/50',
    sandTimerText: 'text-amber-400 text-slate-200',
    sandTimerBg: 'hover:bg-amber-500/30',
    navBtn: 'bg-slate-700/80 hover:bg-slate-600 text-slate-200',
  }

  const theme = isStudent ? studentTheme : teacherTheme
  const highlightClass = (control: string) =>
    highlightedControl === control ? 'ring-2 ring-amber-300/90 ring-offset-1 ring-offset-black/40' : ''
  const isRealTeacherBar = isTeacher && teacherTimerInteractive

  if (printHidden) return null

  return (
    <div className={cn(SHARED_LAYOUT.container, theme.text)}>
      {!hideIndex && (
        <span className={cn(SHARED_LAYOUT.leftIndex, theme.index)}>
          {currentIndex + 1} / {totalSlides}
        </span>
      )}
      {hideIndex && <span className="shrink-0" />}
      <div className={SHARED_LAYOUT.rightGroup}>
        {/* Cụm riêng của giáo viên đặt sát bên trái */}
        {isRealTeacherBar && (
          <>
            {onSlideViewModeChange && (
              <div data-control="slide-mode" className={cn('flex rounded-lg border border-slate-600/80 overflow-hidden bg-slate-800/50 shrink-0', highlightClass('slide-mode'))}>
                <button type="button" onClick={() => onSlideViewModeChange('single')} className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors', slideViewMode === 'single' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50')} title="1 slide"><Square className="h-3.5 w-3.5 inline mr-1" />1</button>
                <button type="button" onClick={() => onSlideViewModeChange('triple')} className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors', slideViewMode === 'triple' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50')} title="3 slide"><LayoutGrid className="h-3.5 w-3.5 inline mr-1" />3</button>
              </div>
            )}
            {onOpenStudentView && (
              <button data-control="xem-học-sinh" type="button" onClick={onOpenStudentView} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/35 text-xs font-medium shrink-0 h-9', highlightClass('xem-học-sinh'))} title={tr('Xem fullscreen như học sinh', 'View as student', '全屏学生视图', '全画面生徒表示', '전체화면 학생 보기')}>
                <Presentation className="h-4 w-4" />
                {tr('Xem như học sinh', 'View as student', '学生视图', '生徒表示', '학생 보기')}
              </button>
            )}
            {(onScreenShareStart || onScreenShareStop) && (
              <button
                data-control="chia-sẻ-màn-hình"
                type="button"
                onClick={isScreenSharing ? onScreenShareStop : onScreenShareStart}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 h-9',
                  isScreenSharing ? 'bg-amber-500/30 border border-amber-400/50 text-amber-200' : 'bg-slate-600/50 border border-slate-500/50 text-slate-200 hover:bg-slate-600/70'
                )}
                title={isScreenSharing ? tr('Dừng chia sẻ màn hình. Lưu ý: giữ tab này hiển thị, không chuyển sang tab khác.', 'Stop screen share. Note: keep this tab visible, do not switch tabs.', '停止共享。注意：保持此标签页可见，勿切换。', '共有停止。このタブを表示したままに。', '공유 중지. 이 탭을 보이게 유지하세요.') : tr('Chia sẻ màn hình – chọn tab giáo viên, giữ tab đó hiển thị', 'Share screen – select teacher tab, keep it visible', '共享屏幕 – 选择教师标签页并保持可见', '画面共有 – 教師タブを選択し表示を維持', '화면 공유 – 교사 탭 선택 후 표시 유지')}
              >
                <Monitor className="h-4 w-4" />
                {isScreenSharing ? tr('Dừng chia sẻ', 'Stop share', '停止共享', '共有停止', '공유 중지') : tr('Chia sẻ màn hình', 'Share screen', '共享屏幕', '画面共有', '화면 공유')}
              </button>
            )}
          </>
        )}

        {/* 1. Đồng hồ giáo viên – khung cố định */}
        <div
          data-control={hideTeacherTimer ? undefined : 'teacher-timer'}
          className={cn(SHARED_LAYOUT.teacherTimer, theme.teacherTimerBg, !hideTeacherTimer && highlightClass('teacher-timer'), hideTeacherTimer && 'invisible pointer-events-none')}
          title={tr('Bấm giờ giảng dạy', 'Teaching timer', '教学计时', '授業タイマー', '수업 타이머')}
          aria-hidden={hideTeacherTimer}
        >
            <Timer className={cn('h-4 w-4 shrink-0', theme.teacherTimerText)} />
            <span className={cn('font-mono font-semibold min-w-[2.5rem]', theme.teacherTimerText)}>{formatTimer(teacherTimerSeconds)}</span>
            {teacherTimerInteractive && (
              <>
                <button type="button" onClick={teacherTimerRunning ? onTeacherTimerStop : onTeacherTimerStart} className={cn('p-1 rounded-md', theme.sandTimerBg, theme.teacherTimerText)} title={teacherTimerRunning ? tr('Tạm dừng', 'Pause', '暂停', '一時停止', '일시정지') : tr('Bắt đầu', 'Start', '开始', '開始', '시작')}>
                  {teacherTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={onTeacherTimerReset} className={cn('p-1 rounded-md', theme.sandTimerBg, theme.teacherTimerText)} title={tr('Đặt lại', 'Reset', '重置', 'リセット', '초기화')}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </>
            )}
        </div>

        {/* 2. Chèn – chỉ giáo viên, học sinh ẩn */}
        {isTeacher && curriculumId && onInsertClick && (
          <button
            data-control={hideInsert ? undefined : 'chèn'}
            type="button"
            onClick={hideInsert ? undefined : onInsertClick}
            className={cn(SHARED_LAYOUT.btnInsert, theme.btnInactive, !hideInsert && highlightClass('chèn'), hideInsert && 'invisible pointer-events-none')}
            title={tr('Chèn nội dung (YouTube, GeoGebra, ảnh, quiz...)', 'Insert content', '插入内容', 'コンテンツを挿入', '콘텐츠 삽입')}
            aria-hidden={hideInsert}
          >
            <BarChart2 className="h-4 w-4" />
            {tr('Chèn', 'Insert', '插入', '挿入', '삽입')}
          </button>
        )}

        {/* 2b. Chia sẻ – link + QR (bên trái nút Viết) */}
        {onShareClick && (
          <span className={cn(shareButtonClickableWhenParentDisabled && 'pointer-events-auto')}>
            <button data-control="share" type="button" onClick={onShareClick} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/35 text-xs font-medium shrink-0 h-9', highlightClass('share'))} title={tr('Chia sẻ – link + QR để học sinh quét xem slide', 'Share – link + QR for students to view slides', '分享 – 链接和二维码供学生查看', '共有 – リンクとQRで生徒がスライドを表示', '공유 – 링크와 QR로 학생이 슬라이드 보기')}>
              <Share2 className="h-4 w-4" />
              {tr('Chia sẻ', 'Share', '分享', '共有', '공유')}
            </button>
          </span>
        )}

        {/* 3. Viết + tốc độ */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button data-control="viết" type="button" onClick={onWritingModeToggle} className={cn(SHARED_LAYOUT.btnWrite, writingMode ? theme.btnActive : theme.btnInactive, highlightClass('viết'))} title={tr('Hiệu ứng viết từng ký tự', 'Typing effect', '字符逐字显示', 'タイピング効果', '타이핑 효과')}>
            <PenLine className="h-4 w-4" />
            {tr('Viết', 'Write', '书写', '書き込み', '쓰기')}
          </button>
          {writingMode && (
            <Select value={String(writingSpeedMs)} onValueChange={(v) => onWritingSpeedChange(Number(v))}>
              <SelectTrigger data-control="viết-speed" className={cn(SHARED_LAYOUT.selectSpeed, isStudent ? 'text-white hover:bg-white/20 border-white/30 bg-transparent [&>span]:text-white' : 'bg-slate-600/50 border-slate-500/50 text-slate-200', highlightClass('viết-speed'))} title={tr('Tốc độ gõ (ms/ký tự)', 'Typing speed (ms/char)', '打字速度', '入力速度', '타이핑 속도')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[110]">
                {[30, 50, 80, 120, 180, 250].map((ms) => (
                  <SelectItem key={ms} value={String(ms)}>{ms} ms</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* 4. Tự chạy + interval */}
        <div className="flex items-center gap-1.5">
          <button data-control="tự-chạy" type="button" onClick={onAutoPlayToggle} className={cn(SHARED_LAYOUT.btnAutoPlay, autoPlay ? theme.btnActive : theme.btnInactive, highlightClass('tự-chạy'))} title={tr('Tự chạy slide', 'Auto-play slides', '自动播放', '自動再生', '자동 재생')}>
            {autoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {autoPlay ? tr('Dừng', 'Stop', '停止', '停止', '중지') : tr('Tự chạy', 'Auto', '自动', '自動', '자동')}
          </button>
          <Select value={String(autoPlayIntervalMs)} onValueChange={(v) => onAutoPlayIntervalChange(Number(v))}>
            <SelectTrigger data-control="tự-chạy-interval" className={cn(SHARED_LAYOUT.selectInterval, isStudent ? 'text-white hover:bg-white/20 border-white/30 bg-transparent [&>span]:text-white' : 'bg-slate-600/50 border-slate-500/50 text-slate-200', highlightClass('tự-chạy-interval'))} title={tr('Thời gian mỗi slide', 'Time per slide', '每页时间', '各スライドの時間', '슬라이드당 시간')}>
              <Settings2 className="h-4 w-4 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[110]">
              {[3000, 5000, 7000, 10000, 15000].map((ms) => (
                <SelectItem key={ms} value={String(ms)}>{ms / 1000}s</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 5. Đồng hồ cát – teacher: luôn nút start (gửi lệnh). student: countdown khi chạy */}
        <div data-control="đồng-hồ-cát" className={cn(SHARED_LAYOUT.sandTimer, theme.sandTimerBorder, highlightClass('đồng-hồ-cát'))}>
          <Timer className={cn('h-4 w-4 shrink-0', theme.sandTimerText)} />
          {(isTeacher || sandTimerSeconds <= 0) ? (
            SANDS_SECONDS.map((sec) => (
              <button key={sec} type="button" onClick={() => onSandTimerStart?.(sec)} className={cn('h-7 px-2 rounded text-xs font-medium', theme.sandTimerText, theme.sandTimerBg)} title={tr('Bấm để bắt đầu', 'Click to start', '点击开始', 'クリックで開始', '클릭하여 시작')}>
                {sec / 60}{tr('ph', 'm', '分', '分', '분')}
              </button>
            ))
          ) : (
            <>
              <span className={cn('font-mono text-sm min-w-[3.5rem]', sandTimerSeconds <= 30 && 'text-amber-300 font-bold', theme.sandTimerText)}>{formatTimer(sandTimerSeconds)}</span>
              <button type="button" onClick={onSandTimerToggle} className={cn('h-7 w-7 flex items-center justify-center rounded', theme.sandTimerBg)} title={sandTimerRunning ? tr('Tạm dừng', 'Pause', '暂停', '一時停止', '일시정지') : tr('Tiếp tục', 'Resume', '继续', '再開', '재개')}>
                {sandTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={onSandTimerReset} className={cn('h-7 w-7 flex items-center justify-center rounded', theme.sandTimerBg)} title={tr('Đặt lại', 'Reset', '重置', 'リセット', '초기화')}>
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* 6. Prev / Next */}
        <button data-control="prev" type="button" onClick={onPrev} disabled={currentIndex === 0} className={cn(SHARED_LAYOUT.btnNav, theme.navBtn, 'disabled:opacity-35 disabled:cursor-not-allowed focus:outline-none focus-visible:outline-none', highlightClass('prev'))} title={tr('Slide trước', 'Prev slide', '上一张', '前へ', '이전')}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button data-control="next" type="button" onClick={onNext} disabled={currentIndex >= totalSlides - 1} className={cn(SHARED_LAYOUT.btnNav, theme.navBtn, 'disabled:opacity-35 disabled:cursor-not-allowed focus:outline-none focus-visible:outline-none', highlightClass('next'))} title={tr('Slide sau', 'Next slide', '下一张', '次へ', '다음')}>
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* 7. Student: Print, Close (Share đã chuyển lên trước Viết) */}
        {isStudent && (
          <>
            {onPrint && (
              <button data-control="print" type="button" onClick={onPrint} className={cn(SHARED_LAYOUT.btnIcon, theme.btnBase, highlightClass('print'))} title={tr('In', 'Print', '打印', '印刷', '인쇄')}>
                <Printer className="h-5 w-5" />
              </button>
            )}
            {onClose && (
              <button data-control="close" type="button" onClick={onClose} className={cn(SHARED_LAYOUT.btnIcon, theme.btnBase, highlightClass('close'))} title={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}>
                <X className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
