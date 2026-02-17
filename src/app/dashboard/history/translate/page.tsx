import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, FileText } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { ImagePreview } from '@/components/ui/image-preview'
import { DeleteHistoryButton } from '../delete-button'
import { DownloadTranslateZipButton } from './download-zip-button'

const BATCH_WINDOW_MS = 5 * 60 * 1000 // 5 phút

function groupByBatch<T extends { created_at: string; batch_id?: string | null }>(items: T[]): T[][] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const byBatchId = new Map<string | 'none', T[]>()
  for (const item of sorted) {
    const key = item.batch_id ?? 'none'
    if (!byBatchId.has(key)) byBatchId.set(key, [])
    byBatchId.get(key)!.push(item)
  }
  const batches: T[][] = []
  for (const [key, group] of byBatchId) {
    if (key === 'none') {
      let current: T[] = [group[0]]
      for (let i = 1; i < group.length; i++) {
        const prev = new Date(group[i - 1].created_at).getTime()
        const curr = new Date(group[i].created_at).getTime()
        if (prev - curr <= BATCH_WINDOW_MS) {
          current.push(group[i])
        } else {
          batches.push(current)
          current = [group[i]]
        }
      }
      batches.push(current)
    } else {
      group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      batches.push(group)
    }
  }
  batches.sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime())
  return batches
}

export default async function TranslateHistoryPage() {
  const supabase = createClient()

  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const { data: history, error } = await supabase
    .from('try_on_history')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .eq('feature', 'translate')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching translate history:', error)
    return <div>Failed to load history.</div>
  }

  const batches = groupByBatch(history ?? [])

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Toaster />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Lịch sử dịch ảnh</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-muted-foreground">
            {history?.length || 0} kết quả • {batches.length} gói
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/history">Ảnh đã xử lý</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dich-anh-tai-lieu">
              <FileText className="mr-2 h-4 w-4" /> Dịch ảnh mới
            </Link>
          </Button>
        </div>
      </div>

      {batches.length > 0 ? (
        <div className="space-y-10">
          {batches.map((batch, batchIdx) => (
            <div key={batchIdx} className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Gói {batchIdx + 1} • {new Date(batch[0].created_at).toLocaleString('vi-VN')} • {batch.length} ảnh
                </h2>
                <DownloadTranslateZipButton items={batch} label={`Tải gói ${batchIdx + 1} (zip)`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {batch.map((item) => (
            <Card key={item.id} className="overflow-hidden flex flex-col">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-1 h-3 w-3" />
                  {new Date(item.created_at).toLocaleDateString('vi-VN')}
                </div>
                <Badge variant="default">Đã dịch</Badge>
              </CardHeader>
              <CardContent className="p-4 flex-1 space-y-4">
                {item.result_image_url && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Ảnh đã dịch</p>
                      <div className="relative aspect-[4/3] rounded-md overflow-hidden border-2 border-primary">
                        <ImagePreview
                          src={item.result_image_url}
                          alt="Đã dịch"
                          className="w-full h-full"
                        />
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={item.result_image_url}
                          download={`dich-${item.id}.png`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button size="sm" variant="default" className="w-full">
                            Tải ảnh đã dịch
                          </Button>
                        </a>
                        <DeleteHistoryButton id={item.id} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Ảnh gốc</p>
                      <div className="relative aspect-[4/3] rounded-md overflow-hidden border bg-muted">
                        <ImagePreview
                          src={item.original_image_url}
                          alt="Gốc"
                          className="w-full h-full"
                        />
                      </div>
                      <a
                        href={item.original_image_url}
                        download={`goc-${item.id}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline" className="w-full text-xs">
                          Tải ảnh gốc
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h3 className="text-lg font-medium">Chưa có lịch sử dịch ảnh</h3>
          <p className="text-muted-foreground mt-1">Dịch ảnh tài liệu (1 ảnh, thư mục hoặc file Excel) để xem lịch sử tại đây.</p>
          <Button className="mt-4" asChild>
            <Link href="/dich-anh-tai-lieu">Dịch ảnh ngay</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
