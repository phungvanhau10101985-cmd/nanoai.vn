'use client'

import type React from 'react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { nextWeddingMusicMix, shuffleWeddingMusicUrls, weddingMusicQueue } from '@/lib/wedding/wedding-music-library'

function formatWeddingMusicClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function clampSegment(duration: number, startRaw: number | null, endRaw: number | null) {
  const start = startRaw != null && Number.isFinite(startRaw) ? Math.max(0, startRaw) : 0
  let end = endRaw != null && Number.isFinite(endRaw) ? endRaw : null
  if (!Number.isFinite(duration) || duration <= 0 || duration === Infinity) {
    return { start, end: null as number | null }
  }
  const s = Math.min(start, Math.max(0, duration - 0.05))
  if (end != null) {
    end = Math.min(end, duration)
    if (end <= s + 0.08) end = null
  }
  return { start: s, end }
}

export type WeddingInvitationAudioHandle = {
  playFromUserGesture: () => void
  /** Bật/tắt phát (giữ vị trí currentTime khi tạm dừng). */
  togglePlayback: () => void
  pausePlayback: () => void
  /** Giây tại playhead của thẻ audio (để đặt «bắt đầu phát» từ nút trong form chỉnh sửa). */
  getCurrentPlaybackTimeSec: () => number | null
}

type Props = {
  src: string
  /** Demo: phát lần lượt, hết bài thì bài khác trong kho. Thiệp khách để trống và lặp một bài. */
  trackQueue?: readonly string[]
  loop?: boolean
  playStartSec?: number | null
  playEndSec?: number | null
  preload?: 'none' | 'metadata' | 'auto'
  className?: string
  'aria-label'?: string
  /** 404 / mất file CDN — báo để khách không thấy 0:00 mãi */
  onSourceError?: React.ReactEventHandler<HTMLAudioElement>
  /** File đã có metadata. Gỡ báo lỗi tải giả khi thiệp đang thu nhỏ. */
  onReady?: () => void
  /** Phát / tạm dừng (cho nút nổi thiệp công khai). */
  onPlayingChange?: (playing: boolean) => void
}

/** Thẻ audio thiệp cưới: phát trong khoảng [start, end) và lặp (end trống = đến hết file). */
export const WeddingInvitationAudio = forwardRef<WeddingInvitationAudioHandle | null, Props>(
  function WeddingInvitationAudio(
    {
      src,
      trackQueue,
      loop = true,
      playStartSec,
      playEndSec,
      preload = 'none',
      className = 'w-full',
      'aria-label': ariaLabel,
      onSourceError,
      onReady,
      onPlayingChange,
    },
    ref,
  ) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const segmentRef = useRef({ start: 0, end: null as number | null })
    const playingChangeRef = useRef(onPlayingChange)
    const onReadyRef = useRef(onReady)
    const unmuteOnNextPlayRef = useRef(false)
    const queueKey = (trackQueue ?? []).join('\0')
    const [mixOrder, setMixOrder] = useState<string[]>(() => weddingMusicQueue(trackQueue))
    const [mixIndex, setMixIndex] = useState(0)
    const mixOrderRef = useRef(mixOrder)
    const mixIndexRef = useRef(mixIndex)
    const mixSkipsRef = useRef(0)
    const handoffRef = useRef(false)
    const startedRef = useRef(false)
    const seekingRef = useRef(false)
    const [clock, setClock] = useState({ elapsed: 0, span: 0, playing: false })
    mixOrderRef.current = mixOrder
    mixIndexRef.current = mixIndex
    const queueMode = mixOrder.length > 0
    const activeSrc = queueMode ? mixOrder[mixIndex] || mixOrder[0] || '' : src
    playingChangeRef.current = onPlayingChange
    onReadyRef.current = onReady

    const goNext = useCallback((autoplay = true) => {
      const step = nextWeddingMusicMix(mixOrderRef.current, mixIndexRef.current)
      if (step.order.length === 0) return
      mixOrderRef.current = step.order
      mixIndexRef.current = step.index
      handoffRef.current = autoplay
      setMixOrder(step.order)
      setMixIndex(step.index)
    }, [])

    useEffect(() => {
      const urls = queueKey ? queueKey.split('\0') : []
      setMixOrder(urls.length ? shuffleWeddingMusicUrls(urls) : [])
      setMixIndex(0)
      mixSkipsRef.current = 0
    }, [queueKey])

    const recomputeSegment = useCallback(() => {
      const el = audioRef.current
      if (!el) return
      const { start, end } = clampSegment(el.duration, playStartSec ?? null, playEndSec ?? null)
      segmentRef.current = { start, end }
    }, [playStartSec, playEndSec])

    useEffect(() => {
      const el = audioRef.current
      if (!el) return

      const onLoadedMetadata = () => {
        recomputeSegment()
        onReadyRef.current?.()
        const { start } = segmentRef.current
        try {
          el.currentTime = start
        } catch {
          /* ignore */
        }
      }

      const onTimeUpdate = () => {
        const { start, end } = segmentRef.current
        if (end == null) return
        if (el.currentTime >= end - 0.06) {
          if (loop) {
            el.currentTime = start
            void el.play().catch(() => {})
          } else {
            el.pause()
            el.currentTime = start
          }
        }
      }

      const onEnded = () => {
        if (mixOrderRef.current.length > 0) {
          mixSkipsRef.current = 0
          goNext()
          return
        }
        if (!loop) return
        recomputeSegment()
        const { start } = segmentRef.current
        el.currentTime = start
        void el.play().catch(() => {})
      }

      const onPlay = () => {
        startedRef.current = true
        mixSkipsRef.current = 0
        if (!unmuteOnNextPlayRef.current) return
        unmuteOnNextPlayRef.current = false
        el.muted = false
        if (el.volume < 0.05) el.volume = 1
      }

      el.addEventListener('loadedmetadata', onLoadedMetadata)
      el.addEventListener('timeupdate', onTimeUpdate)
      el.addEventListener('ended', onEnded)
      el.addEventListener('play', onPlay)
      return () => {
        el.removeEventListener('loadedmetadata', onLoadedMetadata)
        el.removeEventListener('timeupdate', onTimeUpdate)
        el.removeEventListener('ended', onEnded)
        el.removeEventListener('play', onPlay)
      }
    }, [activeSrc, goNext, loop, recomputeSegment, playStartSec, playEndSec])

    useEffect(() => {
      const el = audioRef.current
      if (!el || !handoffRef.current) return
      const kick = () => {
        if (!handoffRef.current) return
        handoffRef.current = false
        startedRef.current = true
        void el.play().catch(() => {})
      }
      if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        kick()
        return
      }
      el.addEventListener('canplay', kick, { once: true })
      return () => el.removeEventListener('canplay', kick)
    }, [activeSrc])

    useEffect(() => {
      const el = audioRef.current
      if (!el || typeof ResizeObserver === 'undefined') return
      let lastWidth = el.offsetWidth
      const retry = () => {
        const width = el.offsetWidth
        const grew = width >= 2 && lastWidth < 2
        lastWidth = width
        if (!grew || !el.error) return
        el.load()
      }
      const observer = new ResizeObserver(retry)
      observer.observe(el)
      return () => observer.disconnect()
    }, [activeSrc])

    useEffect(() => {
      const el = audioRef.current
      if (!el) return
      let frame = 0
      const paint = () => {
        if (seekingRef.current) return
        const { start, end } = segmentRef.current
        const duration = Number.isFinite(el.duration) ? el.duration : 0
        const spanEnd = end ?? (duration > 0 ? duration : start)
        const span = Math.max(0, spanEnd - start)
        const elapsed = Math.min(span, Math.max(0, el.currentTime - start))
        const playing = !el.paused && !el.ended
        setClock((prev) => {
          if (prev.playing === playing && Math.abs(prev.elapsed - elapsed) < 0.2 && Math.abs(prev.span - span) < 0.2) return prev
          return { elapsed, span, playing }
        })
      }
      const loop = () => {
        paint()
        if (!el.paused && !el.ended) frame = window.requestAnimationFrame(loop)
      }
      const startLoop = () => {
        if (frame) window.cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(loop)
      }
      const stopLoop = () => {
        if (frame) window.cancelAnimationFrame(frame)
        frame = 0
        paint()
      }
      el.addEventListener('loadedmetadata', paint)
      el.addEventListener('durationchange', paint)
      el.addEventListener('timeupdate', paint)
      el.addEventListener('play', startLoop)
      el.addEventListener('pause', stopLoop)
      el.addEventListener('ended', stopLoop)
      paint()
      return () => {
        if (frame) window.cancelAnimationFrame(frame)
        el.removeEventListener('loadedmetadata', paint)
        el.removeEventListener('durationchange', paint)
        el.removeEventListener('timeupdate', paint)
        el.removeEventListener('play', startLoop)
        el.removeEventListener('pause', stopLoop)
        el.removeEventListener('ended', stopLoop)
      }
    }, [activeSrc])

    const seekElapsed = (elapsed: number) => {
      const el = audioRef.current
      if (!el) return
      const { start, end } = segmentRef.current
      const duration = Number.isFinite(el.duration) ? el.duration : start + elapsed
      const spanEnd = end ?? duration
      const next = Math.min(Math.max(start, start + elapsed), spanEnd)
      try {
        el.currentTime = next
      } catch {
        /* metadata chưa sẵn */
      }
      const span = Math.max(0, spanEnd - start)
      setClock((prev) => ({ ...prev, elapsed: Math.min(span, Math.max(0, next - start)), span }))
    }

    useEffect(() => {
      const el = audioRef.current
      if (!el) return
      const cb = playingChangeRef.current
      if (!cb) return
      const emit = () => cb(!el.paused)
      el.addEventListener('play', emit)
      el.addEventListener('pause', emit)
      el.addEventListener('ended', emit)
      emit()
      return () => {
        el.removeEventListener('play', emit)
        el.removeEventListener('pause', emit)
        el.removeEventListener('ended', emit)
      }
    }, [activeSrc])

    useImperativeHandle(
      ref,
      () => ({
        playFromUserGesture() {
          const el = audioRef.current
          if (!el?.src?.trim()) return

          const seekToSegmentStartThenPlay = () => {
            recomputeSegment()
            const { start } = segmentRef.current
            try {
              el.currentTime = start
            } catch {
              /* ignore */
            }
            // Trong đúng cú bấm mở thiệp. Mỗi lần mở đều có tiếng, không nhớ lần tắt trước.
            unmuteOnNextPlayRef.current = true
            el.muted = false
            el.volume = 1
            void el.play().catch(() => {})
          }

          if (el.error) el.load()
          seekToSegmentStartThenPlay()

          /** Preload/chưa buffer: play() trong gesture có thể thất bại — thử lại khi có đủ dữ liệu. */
          if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && !el.error) {
            return
          }
          const cleanup = () => {
            el.removeEventListener('canplay', retry)
            el.removeEventListener('error', cleanupOnErr)
          }
          const retry = () => {
            cleanup()
            if (!el.paused) return
            seekToSegmentStartThenPlay()
          }
          const cleanupOnErr = () => {
            cleanup()
          }
          el.addEventListener('canplay', retry, { once: true })
          el.addEventListener('error', cleanupOnErr, { once: true })
        },
        getCurrentPlaybackTimeSec() {
          const el = audioRef.current
          if (!el) return null
          const ct = el.currentTime
          return Number.isFinite(ct) && ct >= 0 ? ct : null
        },
        togglePlayback() {
          const el = audioRef.current
          if (!el?.src?.trim()) return
          if (el.paused) {
            void el.play().catch(() => {})
          } else {
            el.pause()
          }
        },
        pausePlayback() {
          audioRef.current?.pause()
        },
      }),
      [recomputeSegment],
    )

    return (
      <div className={`relative ${className}`}>
      <audio
        ref={audioRef}
        playsInline
        preload={preload}
        src={activeSrc}
        className="pointer-events-none absolute h-px w-full opacity-0"
        aria-hidden
        onError={(event) => {
          const el = event.currentTarget
          if (el.error?.code === MediaError.MEDIA_ERR_ABORTED) return
          if (el.offsetWidth < 2) return
          if (!queueMode) {
            onSourceError?.(event)
            return
          }
          const autoplay = startedRef.current || handoffRef.current
          mixSkipsRef.current += 1
          if (mixSkipsRef.current >= mixOrderRef.current.length) {
            handoffRef.current = false
            onSourceError?.(event)
            return
          }
          goNext(autoplay)
        }}
      />
      <div className="flex items-center gap-2 text-current">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-current/30"
          aria-label={ariaLabel}
          aria-pressed={clock.playing}
          onClick={() => {
            const el = audioRef.current
            if (!el?.src?.trim()) return
            if (el.paused) void el.play().catch(() => {})
            else el.pause()
          }}
        >
          {clock.playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        </button>
        <span className="w-11 shrink-0 text-xs tabular-nums">{formatWeddingMusicClock(clock.elapsed)}</span>
        <input
          type="range"
          min={0}
          max={clock.span > 0 ? clock.span : 0}
          step={0.1}
          value={clock.span > 0 ? Math.min(clock.elapsed, clock.span) : 0}
          disabled={clock.span <= 0}
          aria-label={ariaLabel}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-current disabled:cursor-default"
          onPointerDown={() => {
            seekingRef.current = true
          }}
          onPointerUp={() => {
            seekingRef.current = false
          }}
          onPointerCancel={() => {
            seekingRef.current = false
          }}
          onChange={(event) => seekElapsed(Number(event.target.value))}
        />
        <span className="w-11 shrink-0 text-right text-xs tabular-nums">{formatWeddingMusicClock(clock.span)}</span>
      </div>
      </div>
    )
  },
)

WeddingInvitationAudio.displayName = 'WeddingInvitationAudio'
