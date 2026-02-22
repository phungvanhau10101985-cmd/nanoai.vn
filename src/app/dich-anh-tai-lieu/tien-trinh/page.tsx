'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
const STORAGE_KEY = 'lastTranslateBatchId'

export default function TranslateProgressLandingPage() {
  const router = useRouter()
  const [checking] = useState(true)

  useEffect(() => {
    try {
      const batchId = localStorage.getItem(STORAGE_KEY)
      if (batchId) {
        router.replace(`/dich-anh-tai-lieu?batchId=${encodeURIComponent(batchId)}`)
        return
      }
    } catch {
      //
    }
    router.replace('/dich-anh-tai-lieu')
  }, [router])

  if (checking) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Đang kiểm tra...</p>
      </div>
    )
  }

  return null
}
