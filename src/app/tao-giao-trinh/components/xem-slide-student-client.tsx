'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { NanoAISlideViewer } from './nano-ai-slide-viewer'
import type { AISlideData } from '../lib/curriculum-to-slides'
import { getPresentationBroadcastChannelName, PRESENTATION_SYNC_QUERY_KEY } from '../lib/presentation-broadcast'
import type { StudentSlidePresentationKind } from '../lib/student-slide-window'

function getWebLocale(): 'vi' | 'en' | 'zh' | 'ja' | 'ko' {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

function tr(locale: string, vi: string, en: string, zh: string, ja: string, ko: string) {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

type SlideData = {
  content: string
  topic: string
  currentIndex: number
  curriculumId: string | null
  slideMode: 'original' | 'shared' | 'personal' | null
  slides: Array<{ title: string; blocks?: Array<{ header?: string; content?: string }>; teacherNotes?: string; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>; visualInput1?: string; visualInput2?: string; visualInput3?: string; visualInput4?: string }>
  worksheetId?: boolean
  worksheetAnswerReveal?: Record<string, number>
  worksheetAnswerTypingEnabled?: Record<string, boolean>
  studentCurriculumRightMode?: 'single-slide' | 'markdown-all'
}

export type XemSlideStudentClientProps = {
  /** Route giáo trình (`/xem-slide`) vs phiếu bài tập (`/xem-slide-phieu`) — tách file trang & URL. */
  presentationKind: StudentSlidePresentationKind
}

/**
 * Logic chung trình chiếu học sinh. Hai route gọi với `presentationKind` khác nhau.
 * Chia sẻ link (?share=) chỉ dùng trên route giáo trình.
 */
export function XemSlideStudentClient({ presentationKind }: XemSlideStudentClientProps) {
  const searchParams = useSearchParams()
  const shareCode = presentationKind === 'curriculum' ? searchParams.get('share') : null
  const presentationBroadcastSyncId = searchParams.get(PRESENTATION_SYNC_QUERY_KEY)
  const [data, setData] = useState<SlideData | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(!!shareCode)
  const [locale, setLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')

  useEffect(() => {
    setLocale(getWebLocale())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.opener) return
    const req = document.documentElement.requestFullscreen ?? (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
    if (req) {
      const t = setTimeout(() => req.call(document.documentElement).catch(() => {}), 300)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    const titlesCurriculum: Record<string, string> = {
      vi: 'Trình chiếu – Chỉ chia sẻ cửa sổ này cho học sinh',
      en: 'Presentation – Share this window only (student view)',
      zh: '演示 – 仅分享此窗口给学生',
      ja: 'プレゼン – このウィンドウのみ共有（生徒用）',
      ko: '프레젠테이션 – 이 창만 공유 (학생 화면)',
    }
    const titlesWorksheet: Record<string, string> = {
      vi: 'Trình chiếu phiếu bài tập (học sinh)',
      en: 'Worksheet presentation (student)',
      zh: '练习单演示（学生）',
      ja: 'ワークシートプレゼン（生徒）',
      ko: '워크시트 프레젠테이션 (학생)',
    }
    document.title =
      presentationKind === 'worksheet'
        ? (titlesWorksheet[locale] ?? titlesWorksheet.vi)
        : (titlesCurriculum[locale] ?? titlesCurriculum.vi)
  }, [locale, presentationKind])

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
              slideMode: res.slideMode === 'personal' || res.slideMode === 'shared' || res.slideMode === 'original' ? res.slideMode : null,
              slides: sl,
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
    const applyCurriculumData = (e: { data?: { type?: string; slides?: unknown; content?: string; topic?: string; currentIndex?: number; curriculumId?: string; slideMode?: string; worksheetId?: boolean; worksheetAnswerReveal?: Record<string, number>; worksheetAnswerTypingEnabled?: Record<string, boolean>; studentCurriculumRightMode?: string } }) => {
      if (e.data?.type !== 'curriculum-data') return
      const sl = Array.isArray(e.data.slides) ? e.data.slides : []
      const scmRaw = e.data?.studentCurriculumRightMode
      const studentCurriculumRightMode =
        scmRaw === 'markdown-all' || scmRaw === 'single-slide' ? scmRaw : undefined
      setData((prev) => {
        const incomingIndexRaw = typeof e.data?.currentIndex === 'number' ? e.data.currentIndex : 0
        const maxIndex = Math.max(0, sl.length - 1)
        const incomingIndex = Math.max(0, Math.min(incomingIndexRaw, maxIndex))
        const wr = e.data!.worksheetAnswerReveal
        const wte = e.data!.worksheetAnswerTypingEnabled
        return {
          content: e.data!.content ?? '',
          topic: e.data!.topic ?? '',
          currentIndex: incomingIndex,
          curriculumId: typeof e.data!.curriculumId === 'string' ? e.data!.curriculumId : null,
          slideMode: e.data!.slideMode === 'personal' || e.data!.slideMode === 'shared' || e.data!.slideMode === 'original' ? e.data!.slideMode : null,
          slides: sl,
          worksheetId: typeof e.data!.worksheetId === 'boolean' ? e.data!.worksheetId : prev?.worksheetId,
          worksheetAnswerReveal:
            wr != null && typeof wr === 'object' ? { ...wr } : (prev?.worksheetAnswerReveal ?? {}),
          worksheetAnswerTypingEnabled:
            wte != null && typeof wte === 'object' ? { ...wte } : (prev?.worksheetAnswerTypingEnabled ?? {}),
          studentCurriculumRightMode: studentCurriculumRightMode ?? prev?.studentCurriculumRightMode,
        }
      })
    }
    const applyWorksheetReveal = (data: { worksheetAnswerReveal?: unknown }) => {
      const wr = data.worksheetAnswerReveal
      if (wr == null || typeof wr !== 'object') return
      setData((d) => (d ? { ...d, worksheetAnswerReveal: { ...(wr as Record<string, number>) } } : d))
    }
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'worksheet-answer-reveal') {
        applyWorksheetReveal(e.data)
        return
      }
      applyCurriculumData(e)
    }
    window.addEventListener('message', handler)
    window.opener?.postMessage({ type: 'request-curriculum' }, window.location.origin)
    const channelName = getPresentationBroadcastChannelName(presentationBroadcastSyncId)
    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(channelName)
      channel.addEventListener('message', (event) => {
        if (event.data?.type === 'worksheet-answer-reveal') applyWorksheetReveal(event.data)
        else applyCurriculumData(event)
      })
      channel.postMessage({ type: 'request-curriculum' })
    }
    return () => {
      window.removeEventListener('message', handler)
      channel?.close()
    }
  }, [shareCode, locale, presentationBroadcastSyncId])

  if (shareLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400">
          {tr(locale, 'Đang tải slide...', 'Loading slides...', '正在加载幻灯片...', 'スライドを読み込み中...', '슬라이드 로딩 중...')}
        </p>
      </div>
    )
  }
  if (shareError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-rose-400">{shareError}</p>
      </div>
    )
  }
  if (!data || data.slides.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400">
          {presentationKind === 'worksheet'
            ? tr(
                locale,
                'Đang chờ dữ liệu phiếu bài tập từ giáo viên...',
                'Waiting for worksheet data from teacher...',
                '等待教师发送练习数据...',
                '教師からワークシートデータを待機中...',
                '교사의 워크시트 데이터 대기 중...'
              )
            : tr(locale, 'Đang chờ dữ liệu từ giao diện giáo viên...', 'Waiting for data from teacher view...', '等待教师界面数据...', '教師画面のデータを待機中...', '교사 화면 데이터 대기 중...')}
        </p>
      </div>
    )
  }

  const worksheetPresentation = presentationKind === 'worksheet' || !!data.worksheetId

  const aiSlides: AISlideData[] = data.slides.map((s) => ({
    title: s.title ?? '',
    blocks: (s.blocks ?? []).map((b) => ({
      ...(b as object),
      header: (b as { header?: string }).header ?? '',
      content: (b as { content?: string }).content ?? '',
    })),
    imageUrl: s.imageUrl,
    visualEmbed: s.visualEmbed,
    visualLayout: s.visualLayout,
    visualCells: s.visualCells,
    visualInput1: s.visualInput1,
    visualInput2: s.visualInput2,
    visualInput3: s.visualInput3,
    visualInput4: s.visualInput4,
  }))

  return (
    <NanoAISlideViewer
      curriculumMarkdown={data.content}
      topic={data.topic}
      onClose={() => window.close()}
      aiSlides={aiSlides}
      curriculumId={data.curriculumId}
      tr={tr.bind(null, locale)}
      slideMode={data.slideMode ?? undefined}
      initialSlideIndex={data.currentIndex}
      isTeacherView={false}
      worksheetPresentation={worksheetPresentation}
      worksheetAnswerReveal={data.worksheetAnswerReveal ?? {}}
      worksheetAnswerTypingEnabled={data.worksheetAnswerTypingEnabled ?? {}}
      presentationBroadcastSyncId={presentationBroadcastSyncId}
      syncedStudentCurriculumRightMode={
        worksheetPresentation ? null : (data.studentCurriculumRightMode ?? null)
      }
    />
  )
}
