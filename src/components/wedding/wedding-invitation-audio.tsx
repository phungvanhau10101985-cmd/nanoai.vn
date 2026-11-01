'use client'

import type React from 'react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { nextWeddingMusicMix, shuffleWeddingMusicUrls, weddingMusicQueue } from '@/lib/wedding/wedding-music-library'

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
      onPlayingChange,
    },
    ref,
  ) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const segmentRef = useRef({ start: 0, end: null as number | null })
    const playingChangeRef = useRef(onPlayingChange)
    const unmuteOnNextPlayRef = useRef(false)
    const queueKey = (trackQueue ?? []).join('\0')
    const [mixOrder, setMixOrder] = useState<string[]>(() => weddingMusicQueue(trackQueue))
    const [mixIndex, setMixIndex] = useState(0)
    const mixOrderRef = useRef(mixOrder)
    const mixIndexRef = useRef(mixIndex)
    const mixSkipsRef = useRef(0)
    const handoffRef = useRef(false)
    const startedRef = useRef(false)
    mixOrderRef.current = mixOrder
    mixIndexRef.current = mixIndex
    const queueMode = mixOrder.length > 0
    const activeSrc = queueMode ? mixOrder[mixIndex] || mixOrder[0] || '' : src
    playingChangeRef.current = onPlayingChange

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

          seekToSegmentStartThenPlay()

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
      }),
      [recomputeSegment],
    )

    return (
      <audio
        ref={audioRef}
        controls
        playsInline
        preload={preload}
        src={activeSrc}
        className={className}
        aria-label={ariaLabel}
        onError={(event) => {
          if (event.currentTarget.error?.code === MediaError.MEDIA_ERR_ABORTED) return
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
    )
  },
)

WeddingInvitationAudio.displayName = 'WeddingInvitationAudio'
