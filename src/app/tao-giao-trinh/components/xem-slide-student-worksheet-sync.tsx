'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getPresentationBroadcastChannelName, PRESENTATION_SYNC_QUERY_KEY } from '../lib/presentation-broadcast'

/** Slide payload trình chiếu học sinh — chỉ luồng phiếu bài tập (không trộn chế độ cột phải giáo trình). */
export type WorksheetStudentViewData = {
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
  worksheetAnswerReveal: Record<string, number>
  worksheetAnswerTypingEnabled: Record<string, boolean>
  worksheetStemTypingEnabled: boolean
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
  worksheetStemTypingEnabled?: boolean
}

/**
 * Đồng bộ phiếu: postMessage / BroadcastChannel từ GV phiếu.
 * Không xử lý `?share=`, không lưu `studentCurriculumRightMode`.
 */
export function useWorksheetStudentSlideSync(): {
  data: WorksheetStudentViewData | null
  presentationBroadcastSyncId: string | null
} {
  const searchParams = useSearchParams()
  const presentationBroadcastSyncId = searchParams.get(PRESENTATION_SYNC_QUERY_KEY)
  const [data, setData] = useState<WorksheetStudentViewData | null>(null)

  useEffect(() => {
    const applyWorksheetPayload = (raw: { data?: WirePayload }) => {
      const e = raw.data
      if (e?.type !== 'curriculum-data') return
      const sl = Array.isArray(e.slides) ? e.slides : []
      const wr = e.worksheetAnswerReveal
      const wte = e.worksheetAnswerTypingEnabled
      const wStem = e.worksheetStemTypingEnabled

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
          worksheetAnswerReveal:
            wr != null && typeof wr === 'object' ? { ...wr } : (prev?.worksheetAnswerReveal ?? {}),
          worksheetAnswerTypingEnabled:
            wte != null && typeof wte === 'object' ? { ...wte } : (prev?.worksheetAnswerTypingEnabled ?? {}),
          worksheetStemTypingEnabled: typeof wStem === 'boolean' ? wStem : (prev?.worksheetStemTypingEnabled ?? true),
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
              worksheetAnswerReveal: wr != null && typeof wr === 'object' ? { ...(wr as Record<string, number>) } : d.worksheetAnswerReveal,
              worksheetAnswerTypingEnabled:
                wte != null && typeof wte === 'object' ? { ...(wte as Record<string, boolean>) } : d.worksheetAnswerTypingEnabled,
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
      applyWorksheetPayload(ev)
    }

    window.addEventListener('message', handler)
    window.opener?.postMessage({ type: 'request-curriculum' }, window.location.origin)

    const channelName = getPresentationBroadcastChannelName(presentationBroadcastSyncId)
    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(channelName)
      channel.addEventListener('message', (event) => {
        if (event.data?.type === 'worksheet-answer-reveal') applyAnswerRevealOnly(event.data)
        else applyWorksheetPayload(event)
      })
      channel.postMessage({ type: 'request-curriculum' })
    }

    return () => {
      window.removeEventListener('message', handler)
      channel?.close()
    }
  }, [presentationBroadcastSyncId])

  return { data, presentationBroadcastSyncId }
}
