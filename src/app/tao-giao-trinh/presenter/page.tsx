'use client'

import { useEffect } from 'react'

/** Ghi chú đã gộp vào cửa sổ Giáo trình. Chuyển hướng sang giao diện giáo viên. */
export default function PresenterPage() {
  useEffect(() => {
    window.location.replace('/tao-giao-trinh/giao-vien')
  }, [])
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <p className="text-slate-400">Đang chuyển đến Giáo trình + Ghi chú...</p>
    </div>
  )
}
