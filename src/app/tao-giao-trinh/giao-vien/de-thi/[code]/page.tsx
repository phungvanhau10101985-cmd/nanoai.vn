'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const GiaoVienWorksheetPage = dynamic(() => import('../../giao-vien-worksheet-page'))

export default function GiaoVienExamCodePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" aria-hidden />}>
      <GiaoVienWorksheetPage />
    </Suspense>
  )
}
