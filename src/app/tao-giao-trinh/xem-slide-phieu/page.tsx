'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const XemSlideStudentWorksheetClient = dynamic(() => import('../components/xem-slide-student-worksheet-client'))

/**
 * Trình chiếu học sinh – phiếu bài tập (mở từ giao viên có `worksheetId`).
 * Giáo trình: `/giao-trinh/xem-slide`.
 */
export default function XemSlidePhieuPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" aria-hidden />}>
      <XemSlideStudentWorksheetClient />
    </Suspense>
  )
}
