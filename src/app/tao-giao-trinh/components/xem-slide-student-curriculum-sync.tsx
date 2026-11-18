'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getPresentationBroadcastChannelName, PRESENTATION_SYNC_QUERY_KEY } from '../lib/presentation-broadcast'
import type { SlideInfographic } from '../lib/slide-infographic'
import { advanceSlideRevealOneStep } from '../lib/worksheet-answer-segments'
import { tr } from './xem-slide-student-ui-locale'

const STUDENT_RUNTIME_CHUNK_SIZE = 2
const STUDENT_RUNTIME_CHUNK_RADIUS = 0

/** Slide payload trình chiếu học sinh — chỉ luồng giáo trình (không trộn model phiếu). */
export type CurriculumStudentViewData = {
  content: string
  topic: string
  currentIndex: number
  curriculumId: string | null
  slideMode: 'original' | 'shared' | 'personal' | null
  slides: Array<{
    title: string
    blocks?: Array<{ header?: string; content?: string }>
    teacherNotes?: string
    imageUrl?: string
    visualEmbed?: string
    visualLayout?: 1 | 2 | 4
    visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>
    visualInput1?: string
    visualInput2?: string
    visualInput3?: string
    visualInput4?: string
    infographic?: SlideInfographic
  }>
  /** Đồng bộ từ GV (wire: `worksheetAnswerReveal`) — hiển thị đáp án / gõ trên slide giáo trình */
  answerRevealProgress: Record<string, number>
  answerTypingEnabled: Record<string, boolean>
  studentCurriculumRightMode?: 'single-slide' | 'markdown-all'
  /** Cột trái trình chiếu: Visual / Infographic trong khung (wire: `teacherSlideLeftPane` trên `curriculum-data`) */
  teacherSlideLeftPane?: 'visual' | 'infographic' | 'whiteboard'
  whiteboard?: { objects?: unknown; camera?: unknown; grid?: unknown }
  /** Một infographic cho cả giáo trình (wire: `curriculum-data`) */
  curriculumInfographic?: SlideInfographic
}

type WirePayload = {
  __syncSeq?: number
  type?: string
  slides?: unknown
  content?: string
  topic?: string
  currentIndex?: number
  curriculumId?: string
  slideMode?: string
  worksheetAnswerReveal?: Record<string, number>
  worksheetAnswerTypingEnabled?: Record<string, boolean>
  studentCurriculumRightMode?: string
  teacherSlideLeftPane?: string
  whiteboard?: unknown
  curriculumInfographic?: unknown
}

function compactSlidesForStudentRuntime(
  slides: CurriculumStudentViewData['slides'],
  currentIndex: number,
  keepFullTextForAllSlides: boolean,
): CurriculumStudentViewData['slides'] {
  if (!Array.isArray(slides) || slides.length <= 0) return []
  const chunkSize = STUDENT_RUNTIME_CHUNK_SIZE
  const radius = STUDENT_RUNTIME_CHUNK_RADIUS
  const currentChunk = Math.floor(Math.max(0, currentIndex) / chunkSize)
  const keepStart = Math.max(0, (currentChunk - radius) * chunkSize)
  const keepEnd = Math.min(slides.length - 1, ((currentChunk + radius + 1) * chunkSize) - 1)

  return slides.map((row, idx) => {
    const s = (row ?? {}) as CurriculumStudentViewData['slides'][number]
    if (idx >= keepStart && idx <= keepEnd) return s
    return {
      title: typeof s.title === 'string' ? s.title : '',
      blocks: keepFullTextForAllSlides ? (Array.isArray(s.blocks) ? s.blocks : []) : undefined,
      teacherNotes: '',
      imageUrl: undefined,
      visualEmbed: undefined,
      visualLayout: undefined,
      visualCells: undefined,
      visualInput1: undefined,
      visualInput2: undefined,
      visualInput3: undefined,
      visualInput4: undefined,
      infographic: undefined,
    }
  })
}

/**
 * Đồng bộ giáo trình: `?share=`, postMessage/BroadcastChannel.
 * Không đọc/ghi field phiếu (`worksheetStemTypingEnabled`, cờ `worksheetId` trên wire).
 */
export function useCurriculumStudentSlideSync(locale: 'vi' | 'en' | 'zh' | 'ja' | 'ko'): {
  data: CurriculumStudentViewData | null
  shareError: string | null
  shareLoading: boolean
  presentationBroadcastSyncId: string | null
} {
  const searchParams = useSearchParams()
  const shareCode = searchParams.get('share')
  const presentationBroadcastSyncId = searchParams.get(PRESENTATION_SYNC_QUERY_KEY)
  const [data, setData] = useState<CurriculumStudentViewData | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(() => !!searchParams.get('share'))
  const [typingSpeedMs, setTypingSpeedMs] = useState(55)
  const processedSyncSeqRef = useRef<Set<number>>(new Set())
  const typingClockRef = useRef({
    armed: false,
    lastTeacherAt: 0,
    paused: {} as Record<string, boolean>,
    visibility: {} as Record<string, boolean>,
  })
  const slideHoldRef = useRef<{ index: number; until: number } | null>(null)
  const phoneBoundRef = useRef(false)

  useEffect(() => {
    if (shareCode) {
      setShareLoading(true)
      setShareError(null)
      fetch(`/api/giao-trinh/share/${encodeURIComponent(shareCode)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.error) {
            setShareError(res.error)
            setData(null)
          } else {
            const sl = Array.isArray(res.slides) ? res.slides : []
            const compactedSlides = compactSlidesForStudentRuntime(sl, 0, false)
            setData({
              content: compactedSlides.length > 0 ? '' : (res.content ?? ''),
              topic: res.topic ?? '',
              currentIndex: 0,
              curriculumId: res.curriculumId ?? null,
              slideMode:
                res.slideMode === 'personal' || res.slideMode === 'shared' || res.slideMode === 'original'
                  ? res.slideMode
                  : null,
              slides: compactedSlides,
              answerRevealProgress: {},
              answerTypingEnabled: {},
            })
          }
        })
        .catch(() => {
          setShareError(tr(locale, 'Lỗi tải dữ liệu', 'Failed to load', '加载失败', '読み込みエラー', '로드 실패'))
          setData(null)
        })
        .finally(() => setShareLoading(false))
      return
    }

    const applyCurriculumPayload = (raw: { data?: WirePayload }) => {
      const e = raw.data
      if (e?.type !== 'curriculum-data') return
      const seq = e.__syncSeq
      if (typeof seq === 'number' && Number.isFinite(seq)) {
        if (processedSyncSeqRef.current.has(seq)) return
        processedSyncSeqRef.current.add(seq)
        if (processedSyncSeqRef.current.size > 120) {
          const arr = Array.from(processedSyncSeqRef.current).sort((a, b) => a - b)
          processedSyncSeqRef.current = new Set(arr.slice(-60))
        }
      }
      const sl = Array.isArray(e.slides) ? e.slides : []
      const scmRaw = e.studentCurriculumRightMode
      const studentCurriculumRightMode =
        scmRaw === 'markdown-all' || scmRaw === 'single-slide' ? scmRaw : undefined
      const wr = e.worksheetAnswerReveal
      const wte = e.worksheetAnswerTypingEnabled

      setData((prev) => {
        const incomingIndexRaw = typeof e.currentIndex === 'number' ? e.currentIndex : 0
        const maxIndex = Math.max(0, sl.length - 1)
        const hold = slideHoldRef.current
        const preferred = hold && Date.now() < hold.until ? hold.index : incomingIndexRaw
        const incomingIndex = Math.max(0, Math.min(preferred, maxIndex))
        const keepFullTextForAllSlides = (studentCurriculumRightMode ?? prev?.studentCurriculumRightMode) === 'markdown-all'
        const compactedSlides = compactSlidesForStudentRuntime(sl, incomingIndex, keepFullTextForAllSlides)
        let nextCurriculumInfographic = prev?.curriculumInfographic
        if (Object.prototype.hasOwnProperty.call(e, 'curriculumInfographic')) {
          const ci = e.curriculumInfographic
          if (ci && typeof ci === 'object' && typeof (ci as SlideInfographic).imageUrl === 'string') {
            nextCurriculumInfographic = ci as SlideInfographic
          } else {
            nextCurriculumInfographic = undefined
          }
        } else if (prev == null && Array.isArray(sl)) {
          for (const row of sl) {
            const inf = (row as { infographic?: SlideInfographic }).infographic
            if (inf && typeof inf.imageUrl === 'string') {
              nextCurriculumInfographic = inf
              break
            }
          }
        }
        return {
          content: compactedSlides.length > 0 ? '' : (e.content ?? ''),
          topic: e.topic ?? '',
          currentIndex: incomingIndex,
          curriculumId: typeof e.curriculumId === 'string' ? e.curriculumId : null,
          slideMode:
            e.slideMode === 'personal' || e.slideMode === 'shared' || e.slideMode === 'original' ? e.slideMode : null,
          slides: compactedSlides,
          answerRevealProgress:
            wr != null && typeof wr === 'object' ? { ...wr } : (prev?.answerRevealProgress ?? {}),
          answerTypingEnabled:
            wte != null && typeof wte === 'object' ? { ...wte } : (prev?.answerTypingEnabled ?? {}),
          studentCurriculumRightMode: studentCurriculumRightMode ?? prev?.studentCurriculumRightMode,
          curriculumInfographic: nextCurriculumInfographic,
          teacherSlideLeftPane: (() => {
            if (!Object.prototype.hasOwnProperty.call(e, 'teacherSlideLeftPane')) return prev?.teacherSlideLeftPane
            const tls = e.teacherSlideLeftPane
            if (tls === 'infographic' || tls === 'visual' || tls === 'whiteboard') return tls
            return undefined
          })(),
        }
      })
    }

    const applyAnswerRevealOnly = (payload: {
      worksheetAnswerReveal?: unknown
      worksheetAnswerTypingEnabled?: unknown
      worksheetAnswerTypingPaused?: unknown
      answerVisibility?: unknown
      typingSpeedMs?: unknown
      currentIndex?: unknown
      typingOn?: unknown
      control?: unknown
      typingExact?: unknown
    }) => {
      const wr = payload.worksheetAnswerReveal
      const wte = payload.worksheetAnswerTypingEnabled
      if ((wr == null || typeof wr !== 'object') && (wte == null || typeof wte !== 'object') && typeof payload.typingOn !== 'boolean') return
      const clock = typingClockRef.current
      clock.lastTeacherAt = Date.now()
      clock.armed = true
      const pausedIn = payload.worksheetAnswerTypingPaused
      const pausedObj = pausedIn && typeof pausedIn === 'object' ? pausedIn as Record<string, boolean> : null
      if (payload.control === true && pausedObj) {
        clock.paused = pausedObj
      } else if (pausedObj && Object.values(pausedObj).some(Boolean)) {
        clock.paused = pausedObj
      }
      if (payload.control === true && payload.answerVisibility && typeof payload.answerVisibility === 'object') {
        clock.visibility = payload.answerVisibility as Record<string, boolean>
      }
      if (typeof payload.typingSpeedMs === 'number' && payload.typingSpeedMs >= 15 && payload.typingSpeedMs <= 180) {
        setTypingSpeedMs(payload.typingSpeedMs)
      }
      const held = Object.values(clock.paused).some(Boolean)
      setData((d) => {
        if (!d) return d
        let progress = d.answerRevealProgress
        if (wr != null && typeof wr === 'object') {
          const incoming = wr as Record<string, number>
          const exact = payload.control === true && payload.typingExact === true
          const keys = Object.keys(incoming)
          if (held && payload.control !== true) progress = d.answerRevealProgress
          else if (exact) progress = { ...incoming }
          else if (keys.length === 0) progress = d.answerRevealProgress
          else {
            progress = { ...d.answerRevealProgress }
            for (const key of keys) {
              const value = incoming[key]
              if (typeof value === 'number' && Number.isFinite(value)) {
                progress[key] = Math.max(progress[key] ?? 0, value)
              }
            }
          }
        }
        let enabled = d.answerTypingEnabled
        if (wte != null && typeof wte === 'object') {
          enabled = { ...(wte as Record<string, boolean>) }
        } else if (typeof (payload as { typingOn?: unknown }).typingOn === 'boolean') {
          const on = (payload as { typingOn: boolean }).typingOn
          enabled = Object.fromEntries(Object.keys(d.answerTypingEnabled).map((k) => [k, on]))
        }
        return {
          ...d,
          answerRevealProgress: progress,
          answerTypingEnabled: enabled,
        }
      })
    }

    const handler = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return
      if (ev.data?.type === 'slide-go' && typeof ev.data.index === 'number') {
        const index = ev.data.index
        slideHoldRef.current = { index, until: Date.now() + 1500 }
        setData((d) => (d && d.currentIndex !== index ? { ...d, currentIndex: index } : d))
        return
      }
      if (ev.data?.type === 'worksheet-answer-reveal') {
        applyAnswerRevealOnly(ev.data)
        return
      }
      applyCurriculumPayload(ev)
    }

    window.addEventListener('message', handler)
    window.opener?.postMessage({ type: 'request-curriculum' }, window.location.origin)

    const channelName = getPresentationBroadcastChannelName(presentationBroadcastSyncId)
    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(channelName)
      channel.addEventListener('message', (event) => {
        if (event.data?.type === 'slide-go' && typeof event.data.index === 'number') {
          const index = event.data.index
          slideHoldRef.current = { index, until: Date.now() + 1500 }
          setData((d) => (d && d.currentIndex !== index ? { ...d, currentIndex: index } : d))
        } else if (event.data?.type === 'worksheet-answer-reveal') applyAnswerRevealOnly(event.data)
        else applyCurriculumPayload(event)
      })
      channel.postMessage({ type: 'request-curriculum' })
    }

    return () => {
      window.removeEventListener('message', handler)
      channel?.close()
    }
  }, [shareCode, locale, presentationBroadcastSyncId])

  useEffect(() => {
    if (shareCode) return
    const ms = Math.max(15, typingSpeedMs)
    const id = window.setInterval(() => {
      if (document.hidden) return
      const clock = typingClockRef.current
      if (!clock.armed) return
      setData((d) => {
        if (!d?.curriculumId) return d
        const next = advanceSlideRevealOneStep(d.answerRevealProgress, d.slides[d.currentIndex], d.currentIndex, {
          worksheetPresentation: false,
          hasCurriculumSegmentTyping: true,
          numberedTitle: d.studentCurriculumRightMode === 'markdown-all',
          typingEnabled: d.answerTypingEnabled,
          typingPaused: clock.paused,
          answerVisibility: clock.visibility,
        })
        if (next === d.answerRevealProgress) return d
        return { ...d, answerRevealProgress: next }
      })
    }, ms)
    return () => window.clearInterval(id)
  }, [shareCode, typingSpeedMs])

  useEffect(() => {
    if (shareCode) return
    let phoneId = ''
    let revision = 0
    let lastIndex = -1
    let seenGen = 0
    const take = (raw: { type?: string; id?: string } | null) => {
      if (raw?.type === 'phone-remote-bind' && typeof raw.id === 'string' && raw.id.trim()) {
        phoneId = raw.id.trim()
        phoneBoundRef.current = true
      }
    }
    const onMsg = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      take(event.data)
    }
    window.addEventListener('message', onMsg)
    let channel: BroadcastChannel | null = null
    if (presentationBroadcastSyncId && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(getPresentationBroadcastChannelName(presentationBroadcastSyncId))
      channel.addEventListener('message', (event) => take(event.data))
    }
    const pull = async () => {
      if (!phoneId) return
      try {
        const liveRes = await fetch(`/api/giao-trinh/phone-remote?id=${encodeURIComponent(phoneId)}&live=1`, { credentials: 'same-origin' })
        if (!liveRes.ok) return
        const live = await liveRes.json().catch(() => null)
        if (!live?.ok) return
        const nextRevision = typeof live.revision === 'number' ? live.revision : 0
        if (nextRevision !== revision) {
          const fullRes = await fetch(`/api/giao-trinh/phone-remote?id=${encodeURIComponent(phoneId)}`, { credentials: 'same-origin' })
          const body = await fullRes.json().catch(() => null)
          if (body?.ok && body.snapshot && typeof body.snapshot === 'object') {
            revision = typeof body.revision === 'number' ? body.revision : nextRevision
            const snap = body.snapshot as {
              slides?: CurriculumStudentViewData['slides']
              content?: string
              topic?: string
              studentCurriculumRightMode?: string
              curriculumInfographic?: SlideInfographic
            }
            const sl = Array.isArray(snap.slides) ? snap.slides : []
            const mode = snap.studentCurriculumRightMode === 'markdown-all' || snap.studentCurriculumRightMode === 'single-slide'
              ? snap.studentCurriculumRightMode
              : undefined
            const bodyGen = typeof body.indexGen === 'number' ? body.indexGen : 0
            const newer = bodyGen > seenGen
            if (newer) seenGen = bodyGen
            setData((prev) => {
              if (!prev) return prev
              const useIndex = newer && typeof body.index === 'number' ? body.index : prev.currentIndex
              const compacted = compactSlidesForStudentRuntime(sl, useIndex, mode === 'markdown-all')
              return {
                ...prev,
                slides: compacted.length > 0 ? compacted : prev.slides,
                content: typeof snap.content === 'string' ? snap.content : prev.content,
                topic: typeof snap.topic === 'string' ? snap.topic : prev.topic,
                currentIndex: useIndex,
                studentCurriculumRightMode: mode ?? prev.studentCurriculumRightMode,
                curriculumInfographic: snap.curriculumInfographic ?? prev.curriculumInfographic,
              }
            })
            if (mode) {
              window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: { type: 'student-curriculum-right-mode', mode } }))
            }
            if (newer && typeof body.index === 'number' && body.index !== lastIndex) {
              lastIndex = body.index
              window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: { type: 'slide-go', index: body.index } }))
            }
            return
          }
        }
        const liveGen = typeof live.indexGen === 'number' ? live.indexGen : 0
        if (liveGen > seenGen && typeof live.index === 'number' && live.index !== lastIndex) {
          seenGen = liveGen
          const index = live.index
          lastIndex = index
          setData((prev) => (prev && prev.currentIndex !== index ? { ...prev, currentIndex: index } : prev))
          window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: { type: 'slide-go', index } }))
        }
      } catch {
        /* lần sau */
      }
    }
    const timer = window.setInterval(() => { void pull() }, 800)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('message', onMsg)
      channel?.close()
    }
  }, [shareCode, presentationBroadcastSyncId])

  useEffect(() => {
    if (shareCode) return
    if (!presentationBroadcastSyncId) return
    if (data) return
    if (shareError) return
    if (typeof window === 'undefined') return
    // `?sync=` is for same-browser teacher/student bridge; cross-device QR should use `?share=...`.
    const t = window.setTimeout(() => {
      const hasOpener = Boolean(window.opener)
      if (!hasOpener) {
        setShareError(
          tr(
            locale,
            'Link đồng bộ (?sync=...) chỉ dùng khi mở từ giao diện giáo viên cùng trình duyệt. Nếu quét QR trên điện thoại, hãy dùng link chia sẻ (?share=...).',
            'Sync link (?sync=...) only works from the teacher view in the same browser. For phone QR access, use share link (?share=...).',
            '同步链接（?sync=...）仅适用于同一浏览器内由教师界面打开。手机扫码请使用分享链接（?share=...）。',
            '同期リンク（?sync=...）は同一ブラウザ内で教師画面から開く用途です。スマホQRでは共有リンク（?share=...）を使ってください。',
            '동기화 링크(?sync=...)는 같은 브라우저의 교사 화면에서 열 때만 동작합니다. 휴대폰 QR은 공유 링크(?share=...)를 사용하세요.'
          )
        )
      }
    }, 8000)
    return () => window.clearTimeout(t)
  }, [shareCode, presentationBroadcastSyncId, data, shareError, locale])

  return { data, shareError, shareLoading, presentationBroadcastSyncId }
}
