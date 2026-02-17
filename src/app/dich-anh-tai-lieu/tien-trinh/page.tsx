'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, BarChart3 } from 'lucide-react'

const STORAGE_KEY = 'lastTranslateBatchId'

export default function TranslateProgressLandingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    try {
      const batchId = localStorage.getItem(STORAGE_KEY)
      if (batchId) {
        router.replace(`/dich-anh-tai-lieu/tien-trinh/${batchId}`)
        return
      }
    } catch {
      //
    }
    setChecking(false)
  }, [router])

  if (checking) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Đang kiểm tra...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-slate-600" /> Tiến trình dịch ảnh
      </h1>
      <Card className="border shadow-sm">
        <CardContent className="pt-6">
          <p className="text-muted-foreground mb-4">
            Chưa có tiến trình dịch ảnh nào. Bắt đầu dịch nhiều ảnh (thư mục) hoặc file Excel, sau đó quay lại đây để xem tiến độ.
          </p>
          <Button onClick={() => router.push('/dich-anh-tai-lieu')}>
            <FileText className="mr-2 h-4 w-4" /> Đi dịch ảnh
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
