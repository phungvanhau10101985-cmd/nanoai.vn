'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'

const GiaoVienCurriculumPage = dynamic(() => import('./giao-vien-curriculum-page'))
const GiaoVienWorksheetPage = dynamic(() => import('./giao-vien-worksheet-page'))

function GiaoVienRouteInner() {
  const sp = useSearchParams()
  if (sp.get('worksheetId')?.trim()) {
    return <GiaoVienWorksheetPage />
  }
  return <GiaoVienCurriculumPage />
}

/**
 * Cùng path `/tao-giao-trinh/giao-vien` nhưng **hai file component tách hẳn**:
 * - Có `worksheetId` → `giao-vien-worksheet-page.tsx` (phiếu)
 * - Không có → `giao-vien-curriculum-page.tsx` (giáo trình `?t=`)
 */
export default function GiaoVienPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" aria-hidden />}>
      <GiaoVienRouteInner />
    </Suspense>
  )
}
