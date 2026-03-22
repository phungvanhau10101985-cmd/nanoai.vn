'use client'

import { useEffect, useState } from 'react'
import { NanoAISlideViewer } from './nano-ai-slide-viewer'
import type { AISlideData } from '../lib/curriculum-to-slides'
import { getWebLocale, tr, useOpenerFullscreenOnMount } from './xem-slide-student-ui-locale'
import { useWorksheetStudentSlideSync } from './xem-slide-student-worksheet-sync'

/**
 * Trình chiếu học sinh — **phiếu bài tập** (`/giao-trinh/xem-slide-phieu`).
 * Luồng giáo trình: `xem-slide-student-curriculum-client.tsx` + `useCurriculumStudentSlideSync`.
 */
export default function XemSlideStudentWorksheetClient() {
  const [locale, setLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const { data, presentationBroadcastSyncId } = useWorksheetStudentSlideSync()

  useEffect(() => {
    setLocale(getWebLocale())
  }, [])

  useOpenerFullscreenOnMount()

  useEffect(() => {
    const titlesWorksheet: Record<string, string> = {
      vi: 'Trình chiếu phiếu bài tập (học sinh)',
      en: 'Worksheet presentation (student)',
      zh: '练习单演示（学生）',
      ja: 'ワークシートプレゼン（生徒）',
      ko: '워크시트 프레젠테이션 (학생)',
    }
    document.title = titlesWorksheet[locale] ?? titlesWorksheet.vi
  }, [locale])

  if (!data || data.slides.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400">
          {tr(
            locale,
            'Đang chờ dữ liệu phiếu bài tập từ giáo viên...',
            'Waiting for worksheet data from teacher...',
            '等待教师发送练习数据...',
            '教師からワークシートデータを待機中...',
            '교사의 워크시트 데이터 대기 중...'
          )}
        </p>
      </div>
    )
  }

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
      worksheetPresentation
      worksheetAnswerReveal={data.worksheetAnswerReveal}
      worksheetAnswerTypingEnabled={data.worksheetAnswerTypingEnabled}
      worksheetStemTypingEnabled={data.worksheetStemTypingEnabled}
      presentationBroadcastSyncId={presentationBroadcastSyncId}
      syncedStudentCurriculumRightMode={null}
    />
  )
}
