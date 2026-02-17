'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function TienTrinhError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[tien-trinh]', error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[200px] gap-4">
      <h2 className="text-xl font-semibold text-red-700">Đã xảy ra lỗi</h2>
      <p className="text-muted-foreground text-center">{error.message || 'Có lỗi không mong muốn.'}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>Thử lại</Button>
        <Button onClick={() => window.location.href = '/dich-anh-tai-lieu'}>Về trang dịch ảnh</Button>
      </div>
    </div>
  )
}
