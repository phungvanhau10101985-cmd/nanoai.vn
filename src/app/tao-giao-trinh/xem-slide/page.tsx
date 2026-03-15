'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { NanoAISlideViewer } from '../components/nano-ai-slide-viewer'
import type { AISlideData } from '../lib/curriculum-to-slides'

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
  slides: Array<{ title: string; blocks?: Array<{ header?: string; content?: string }>; teacherNotes?: string; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
}

/** Trang trình chiếu (giao diện học sinh) – nhận dữ liệu từ giao-vien qua postMessage hoặc ?share=xxx */
export default function XemSlidePage() {
  const searchParams = useSearchParams()
  const shareCode = searchParams.get('share')
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
    const titles: Record<string, string> = {
      vi: 'Trình chiếu – Chỉ chia sẻ cửa sổ này cho học sinh',
      en: 'Presentation – Share this window only (student view)',
      zh: '演示 – 仅分享此窗口给学生',
      ja: 'プレゼン – このウィンドウのみ共有（生徒用）',
      ko: '프레젠테이션 – 이 창만 공유 (학생 화면)',
    }
    document.title = titles[locale] ?? titles.vi
  }, [locale])

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
    const applyCurriculumData = (e: { data?: { type?: string; slides?: unknown; content?: string; topic?: string; currentIndex?: number; curriculumId?: string; slideMode?: string } }) => {
      if (e.data?.type !== 'curriculum-data') return
      const sl = Array.isArray(e.data.slides) ? e.data.slides : []
      setData((prev) => {
        const incomingIndexRaw = typeof e.data?.currentIndex === 'number' ? e.data.currentIndex : 0
        const maxIndex = Math.max(0, sl.length - 1)
        const incomingIndex = Math.max(0, Math.min(incomingIndexRaw, maxIndex))
        const next = {
          content: e.data!.content ?? '',
          topic: e.data!.topic ?? '',
          currentIndex: incomingIndex,
          curriculumId: typeof e.data!.curriculumId === 'string' ? e.data!.curriculumId : null,
          slideMode: e.data!.slideMode === 'personal' || e.data!.slideMode === 'shared' || e.data!.slideMode === 'original' ? e.data!.slideMode : null,
          slides: sl,
        }
        return next
      })
    }
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      applyCurriculumData(e)
    }
    window.addEventListener('message', handler)
    window.opener?.postMessage({ type: 'request-curriculum' }, window.location.origin)
    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('tao-giao-trinh-sync')
      channel.addEventListener('message', (event) => applyCurriculumData(event))
      channel.postMessage({ type: 'request-curriculum' })
    }
    return () => {
      window.removeEventListener('message', handler)
      channel?.close()
    }
  }, [shareCode, locale])

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
          {tr(locale, 'Đang chờ dữ liệu từ giao diện giáo viên...', 'Waiting for data from teacher view...', '等待教师界面数据...', '教師画面のデータを待機中...', '교사 화면 데이터 대기 중...')}
        </p>
      </div>
    )
  }

  const aiSlides: AISlideData[] = data.slides.map((s) => ({
    title: s.title ?? '',
    blocks: (s.blocks ?? []).map((b: { header?: string; content?: string }) => ({
      header: b.header ?? '',
      content: b.content ?? '',
    })),
    imageUrl: s.imageUrl,
    visualEmbed: s.visualEmbed,
    visualLayout: s.visualLayout,
    visualCells: s.visualCells,
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
    />
  )
}
