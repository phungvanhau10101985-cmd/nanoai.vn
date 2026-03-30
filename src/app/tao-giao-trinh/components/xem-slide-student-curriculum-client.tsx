'use client'

import { useEffect, useState } from 'react'
import { NanoAISlideViewer } from './nano-ai-slide-viewer'
import type { AISlideData } from '../lib/curriculum-to-slides'
import { getWebLocale, tr, useOpenerFullscreenOnMount } from './xem-slide-student-ui-locale'
import { useCurriculumStudentSlideSync } from './xem-slide-student-curriculum-sync'

/**
 * Trình chiếu học sinh — **giáo trình** (`/giao-trinh/xem-slide`).
 * Luồng phiếu: file `xem-slide-student-worksheet-client.tsx` + hook `useWorksheetStudentSlideSync`.
 */
export default function XemSlideStudentCurriculumClient() {
  const [locale, setLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const { data, shareError, shareLoading, presentationBroadcastSyncId } = useCurriculumStudentSlideSync(locale)

  useEffect(() => {
    setLocale(getWebLocale())
  }, [])

  useOpenerFullscreenOnMount()

  useEffect(() => {
    const titlesCurriculum: Record<string, string> = {
      vi: 'Trình chiếu – Chỉ chia sẻ cửa sổ này cho học sinh',
      en: 'Presentation – Share this window only (student view)',
      zh: '演示 – 仅分享此窗口给学生',
      ja: 'プレゼン – このウィンドウのみ共有（生徒用）',
      ko: '프레젠테이션 – 이 창만 공유 (학생 화면)',
    }
    document.title = titlesCurriculum[locale] ?? titlesCurriculum.vi
  }, [locale])

  if (shareLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4 py-8">
        <p className="text-slate-400 text-center text-sm sm:text-base max-w-md">
          {tr(locale, 'Đang tải slide...', 'Loading slides...', '正在加载幻灯片...', 'スライドを読み込み中...', '슬라이드 로딩 중...')}
        </p>
      </div>
    )
  }
  if (shareError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4 py-8">
        <p className="text-rose-400 text-center text-sm sm:text-base max-w-md">{shareError}</p>
      </div>
    )
  }
  if (!data || data.slides.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4 py-8">
        <p className="text-slate-400 text-center text-sm sm:text-base max-w-md">
          {tr(
            locale,
            'Đang chờ dữ liệu từ giao diện giáo viên...',
            'Waiting for data from teacher view...',
            '等待教师界面数据...',
            '教師画面のデータを待機中...',
            '교사 화면 데이터 대기 중...'
          )}
        </p>
      </div>
    )
  }

  // Dùng trực tiếp payload đã được compact ở hook sync, tránh clone toàn bộ slides.
  const aiSlides = data.slides as AISlideData[]

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
      worksheetPresentation={false}
      worksheetAnswerReveal={data.answerRevealProgress}
      worksheetAnswerTypingEnabled={data.answerTypingEnabled}
      worksheetStemTypingEnabled
      presentationBroadcastSyncId={presentationBroadcastSyncId}
      syncedStudentCurriculumRightMode={data.studentCurriculumRightMode ?? null}
      syncedStudentCurriculumLeftPane={data.teacherSlideLeftPane ?? null}
      curriculumInfographic={data.curriculumInfographic ?? null}
    />
  )
}
