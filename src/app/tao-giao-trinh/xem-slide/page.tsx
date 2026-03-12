'use client'

import { useEffect, useState } from 'react'
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

/** Trang trình chiếu (giao diện học sinh) – nhận dữ liệu từ giao-vien qua postMessage */
export default function XemSlidePage() {
  const [data, setData] = useState<{
    content: string
    topic: string
    currentIndex: number
    curriculumId: string | null
    slideMode: 'original' | 'shared' | 'personal' | null
    slides: Array<{ title: string; blocks?: Array<{ header?: string; content?: string }>; teacherNotes?: string; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
  } | null>(null)
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
    const applyCurriculumData = (e: { data?: { type?: string; slides?: unknown; content?: string; topic?: string; currentIndex?: number; curriculumId?: string; slideMode?: string } }) => {
      if (e.data?.type !== 'curriculum-data') return
      const sl = Array.isArray(e.data.slides) ? e.data.slides : []
      setData({
        content: e.data.content ?? '',
        topic: e.data.topic ?? '',
        currentIndex: e.data.currentIndex ?? 0,
        curriculumId: typeof e.data.curriculumId === 'string' ? e.data.curriculumId : null,
        slideMode: e.data.slideMode === 'personal' || e.data.slideMode === 'shared' || e.data.slideMode === 'original' ? e.data.slideMode : null,
        slides: sl,
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
  }, [])

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
    title: s.title,
    blocks: s.blocks ?? [],
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
