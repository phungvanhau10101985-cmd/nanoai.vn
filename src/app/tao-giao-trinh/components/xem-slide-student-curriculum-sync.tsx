'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getPresentationBroadcastChannelName, PRESENTATION_SYNC_QUERY_KEY } from '../lib/presentation-broadcast'
import { tr } from './xem-slide-student-ui-locale'

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
  }>
  /** Đồng bộ từ GV (wire: `worksheetAnswerReveal`) — hiển thị đáp án / gõ trên slide giáo trình */
  answerRevealProgress: Record<string, number>
  answerTypingEnabled: Record<string, boolean>
  studentCurriculumRightMode?: 'single-slide' | 'markdown-all'
}

type WirePayload = {
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

  useEffect(() => {
    if (shareCode) {
      setShareLoading(true)
      setShareError(null)
      fetch(`/api/tao-giao-trinh/share/${encodeURIComponent(shareCode)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.error) {
            setShareError(res.error)
            setData(null)
          } else {
            const sl = Array.isArray(res.slides) ? res.slides : []
            setData({
              content: res.content ?? '',
              topic: res.topic ?? '',
              currentIndex: 0,
              curriculumId: res.curriculumId ?? null,
              slideMode:
                res.slideMode === 'personal' || res.slideMode === 'shared' || res.slideMode === 'original'
                  ? res.slideMode
                  : null,
              slides: sl,
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
        return {
          content: e.content ?? '',
          topic: e.topic ?? '',
          currentIndex: incomingIndex,
          curriculumId: typeof e.curriculumId === 'string' ? e.curriculumId : null,
          slideMode:
            e.slideMode === 'personal' || e.slideMode === 'shared' || e.slideMode === 'original' ? e.slideMode : null,
          slides: sl,
          answerRevealProgress:
            wr != null && typeof wr === 'object' ? { ...wr } : (prev?.answerRevealProgress ?? {}),
          answerTypingEnabled:
            wte != null && typeof wte === 'object' ? { ...wte } : (prev?.answerTypingEnabled ?? {}),
          studentCurriculumRightMode: studentCurriculumRightMode ?? prev?.studentCurriculumRightMode,
        }
      })
    }

    const applyAnswerRevealOnly = (payload: { worksheetAnswerReveal?: unknown }) => {
      const wr = payload.worksheetAnswerReveal
      if (wr == null || typeof wr !== 'object') return
      setData((d) => (d ? { ...d, answerRevealProgress: { ...(wr as Record<string, number>) } } : d))
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

  return { data, shareError, shareLoading, presentationBroadcastSyncId }
}
