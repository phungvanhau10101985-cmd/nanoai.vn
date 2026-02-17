'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold">Đã xảy ra lỗi</h2>
      <p className="text-muted-foreground text-center max-w-md">
        {error.message || 'Có lỗi không mong muốn xảy ra.'}
      </p>
      <Button onClick={reset}>Thử lại</Button>
    </div>
  )
}
