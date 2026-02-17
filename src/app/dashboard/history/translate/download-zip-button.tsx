'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileArchive, Loader2 } from 'lucide-react'
import { createZipFromHistory } from './actions'
import { useToast } from '@/hooks/use-toast'

type HistoryItem = {
  id: string
  result_image_url: string | null
  created_at: string
}

export function DownloadTranslateZipButton({ items, label = 'Tải zip' }: { items: HistoryItem[]; label?: string }) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleClick = async () => {
    const valid = items.filter((i) => i.result_image_url)
    if (valid.length === 0) {
      toast({ title: 'Không có ảnh để tải', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const result = await createZipFromHistory(
        valid.map((i, idx) => ({
          resultUrl: i.result_image_url!,
          name: `dich_${idx + 1}.png`,
        }))
      )
      if (result.error) {
        toast({ title: 'Lỗi', description: result.error, variant: 'destructive' })
      } else if (result.zipUrl) {
        window.open(result.zipUrl, '_blank')
        toast({ title: 'Đang tải file zip...', duration: 2000 })
      }
    } catch {
      toast({ title: 'Lỗi', description: 'Không thể tạo file zip', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={loading || items.filter((i) => i.result_image_url).length === 0}
      className="border-slate-200 text-slate-700"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileArchive className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  )
}
