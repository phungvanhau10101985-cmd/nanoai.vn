'use client'

import type React from 'react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

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
  /** Giây tại playhead của thẻ audio (để đặt «bắt đầu phát» từ nút trong form chỉnh sửa). */
  getCurrentPlaybackTimeSec: () => number | null
}

type Props = {
  src: string
  loop?: boolean
  playStartSec?: number | null
  playEndSec?: number | null
  preload?: 'none' | 'metadata' | 'auto'
  className?: string
  'aria-label'?: string
  /** 404 / mất file CDN — báo để khách không thấy 0:00 mãi */
  onSourceError?: React.ReactEventHandler<HTMLAudioElement>
  /** Phát / tạm dừng (cho nút nổi thiệp công khai). */
  onPlayingChange?: (playing: boolean) => void
}

/** Thẻ audio thiệp cưới: phát trong khoảng [start, end) và lặp (end trống = đến hết file). */
export const WeddingInvitationAudio = forwardRef<WeddingInvitationAudioHandle | null, Props>(
  function WeddingInvitationAudio(
    {
      src,
      loop = true,
      playStartSec,
      playEndSec,
      preload = 'none',
      className = 'w-full',
      'aria-label': ariaLabel,
      onSourceError,
      onPlayingChange,
    },
    ref,
  ) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const segmentRef = useRef({ start: 0, end: null as number | null })
    const playingChangeRef = useRef(onPlayingChange)
    const fadeRef = useRef<number | null>(null)
    playingChangeRef.current = onPlayingChange

    const cancelFade = useCallback(() => {
      if (fadeRef.current != null) cancelAnimationFrame(fadeRef.current)
      fadeRef.current = null
    }, [])

    const fadeVolume = useCallback((el: HTMLAudioElement, to: number, ms: number) => {
      cancelFade()
      const from = el.volume
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms)
        const eased = 1 - (1 - p) ** 3
        el.volume = from + (to - from) * eased
        if (p < 1) fadeRef.current = requestAnimationFrame(step)
        else fadeRef.current = null
      }
      fadeRef.current = requestAnimationFrame(step)
    }, [cancelFade])

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
        if (!loop) return
        recomputeSegment()
        const { start } = segmentRef.current
        el.currentTime = start
        void el.play().catch(() => {})
      }

      const onPlay = () => {
        if (el.volume < 0.98) fadeVolume(el, 1, 2000)
      }
      const onPause = () => cancelFade()

      el.addEventListener('loadedmetadata', onLoadedMetadata)
      el.addEventListener('timeupdate', onTimeUpdate)
      el.addEventListener('ended', onEnded)
      el.addEventListener('play', onPlay)
      el.addEventListener('pause', onPause)
      return () => {
        el.removeEventListener('loadedmetadata', onLoadedMetadata)
        el.removeEventListener('timeupdate', onTimeUpdate)
        el.removeEventListener('ended', onEnded)
        el.removeEventListener('play', onPlay)
        el.removeEventListener('pause', onPause)
        cancelFade()
      }
    }, [src, loop, recomputeSegment, playStartSec, playEndSec, fadeVolume, cancelFade])

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
    }, [src])

    useImperativeHandle(
      ref,
      () => ({
        playFromUserGesture() {
          const el = audioRef.current
          if (!el?.src?.trim()) return

          const seekToSegmentStartThenPlay = (fromSilence: boolean) => {
            recomputeSegment()
            const { start } = segmentRef.current
            try {
              el.currentTime = start
            } catch {
              /* ignore */
            }
            if (fromSilence) el.volume = 0
            void el.play().catch(() => {
              el.volume = 1
            })
          }

          seekToSegmentStartThenPlay(true)

          /** Preload/chưa buffer: play() trong gesture có thể thất bại — thử lại khi có đủ dữ liệu. */
          if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA || el.error) {
            return
          }
          const cleanup = () => {
            el.removeEventListener('canplay', retry)
            el.removeEventListener('error', cleanupOnErr)
          }
          const retry = () => {
            cleanup()
            if (!el.paused) return
            seekToSegmentStartThenPlay(true)
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
      }),
      [recomputeSegment],
    )

    return (
      <audio
        ref={audioRef}
        controls
        playsInline
        preload={preload}
        src={src}
        className={className}
        aria-label={ariaLabel}
        onError={(e) => onSourceError?.(e)}
      />
    )
  },
)

WeddingInvitationAudio.displayName = 'WeddingInvitationAudio'
