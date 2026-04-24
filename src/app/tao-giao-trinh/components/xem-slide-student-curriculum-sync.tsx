'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getPresentationBroadcastChannelName, PRESENTATION_SYNC_QUERY_KEY } from '../lib/presentation-broadcast'
import type { SlideInfographic } from '../lib/slide-infographic'
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
  teacherSlideLeftPane?: 'visual' | 'infographic'
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
  const processedSyncSeqRef = useRef<Set<number>>(new Set())

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
        const incomingIndex = Math.max(0, Math.min(incomingIndexRaw, maxIndex))
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
            if (tls === 'infographic' || tls === 'visual') return tls
            return undefined
          })(),
        }
      })
    }

    const applyAnswerRevealOnly = (payload: { worksheetAnswerReveal?: unknown; worksheetAnswerTypingEnabled?: unknown }) => {
      const wr = payload.worksheetAnswerReveal
      const wte = payload.worksheetAnswerTypingEnabled
      if ((wr == null || typeof wr !== 'object') && (wte == null || typeof wte !== 'object')) return
      setData((d) =>
        d
          ? {
              ...d,
              answerRevealProgress: wr != null && typeof wr === 'object' ? { ...(wr as Record<string, number>) } : d.answerRevealProgress,
              answerTypingEnabled: wte != null && typeof wte === 'object' ? { ...(wte as Record<string, boolean>) } : d.answerTypingEnabled,
            }
          : d
      )
    }

    const handler = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return
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
        if (event.data?.type === 'worksheet-answer-reveal') applyAnswerRevealOnly(event.data)
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
