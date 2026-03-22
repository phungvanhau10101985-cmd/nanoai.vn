'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const XemSlideStudentCurriculumClient = dynamic(() => import('../components/xem-slide-student-curriculum-client'))

/**
 * Trình chiếu học sinh – giáo trình & link chia sẻ (?share=).
 * Phiếu bài tập: `/tao-giao-trinh/xem-slide-phieu` (file client riêng).
 */
export default function XemSlidePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" aria-hidden />}>
      <XemSlideStudentCurriculumClient />
    </Suspense>
  )
}
