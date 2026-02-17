'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BarChart3 } from 'lucide-react'

const STORAGE_KEY = 'lastTranslateBatchId'

export function TranslateProgressLink({ variant = 'banner' }: { variant?: 'banner' | 'nav' }) {
  const [batchId, setBatchId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const id = localStorage.getItem(STORAGE_KEY)
      if (id) setBatchId(id)
    } catch {
      //
    }
  }, [])

  const progressHref = batchId ? `/dich-anh-tai-lieu/tien-trinh/${batchId}` : '/dich-anh-tai-lieu/tien-trinh'

  if (variant === 'nav') {
    return (
      <Link href={progressHref}>
        <Button variant="outline" size="sm" className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
          <BarChart3 className="mr-2 h-3.5 w-3.5" /> Tiến trình dịch ảnh
        </Button>
      </Link>
    )
  }

  if (!batchId) return null

  return (
    <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/90 p-3 flex items-center justify-between gap-4">
      <p className="text-sm font-medium text-emerald-800">
        Bạn có tiến trình dịch ảnh đang chạy. Có thể xem tiến độ bất cứ lúc nào.
      </p>
      <Link href={progressHref}>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <BarChart3 className="mr-2 h-3.5 w-3.5" /> Xem tiến trình
        </Button>
      </Link>
    </div>
  )
}
