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
import { getCurrentWebLocale } from '@/lib/i18n/server'

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
  const locale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi
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
    <div className="app-shell space-y-6 md:space-y-8">
      <Toaster />
      <div className="section-surface flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{tr('Lịch sử dịch ảnh', 'Translation history', '翻译记录', '翻訳履歴', '번역 기록')}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-muted-foreground">
            {history?.length || 0} {tr('kết quả', 'results', '条结果', '件', '개 결과')} • {batches.length} {tr('gói', 'batches', '批次', 'バッチ', '묶음')}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/history">{tr('Ảnh đã xử lý', 'Processed images', '已处理图片', '処理済み画像', '처리된 이미지')}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dich-anh-tai-lieu">
              <FileText className="mr-2 h-4 w-4" /> {tr('Dịch ảnh mới', 'New translation', '新建翻译', '新しい翻訳', '새 번역')}
            </Link>
          </Button>
        </div>
      </div>

      {batches.length > 0 ? (
        <div className="space-y-10">
          {batches.map((batch, batchIdx) => (
            <div key={batchIdx} className="section-surface space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Gói', 'Batch', '批次', 'バッチ', '묶음')} {batchIdx + 1} • {new Date(batch[0].created_at).toLocaleString('vi-VN')} • {batch.length} {tr('ảnh', 'images', '张', '枚', '장')}
                </h2>
                <DownloadTranslateZipButton items={batch} label={`${tr('Tải gói', 'Download batch', '下载批次', 'バッチをダウンロード', '묶음 다운로드')} ${batchIdx + 1} (zip)`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {batch.map((item) => (
            <Card key={item.id} className="tool-tile overflow-hidden flex flex-col">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-1 h-3 w-3" />
                  {new Date(item.created_at).toLocaleDateString('vi-VN')}
                </div>
                <Badge variant="default">{tr('Đã dịch', 'Translated', '已翻译', '翻訳済み', '번역됨')}</Badge>
              </CardHeader>
              <CardContent className="p-4 flex-1 space-y-4">
                {item.result_image_url && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{tr('Ảnh đã dịch', 'Translated image', '已翻译图片', '翻訳済み画像', '번역된 이미지')}</p>
                      <div className="relative aspect-[4/3] rounded-md overflow-hidden border-2 border-primary">
                        <ImagePreview
                          src={item.result_image_url}
                          alt={tr('Đã dịch', 'Translated', '已翻译', '翻訳済み', '번역됨')}
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
                            {tr('Tải ảnh đã dịch', 'Download translated image', '下载翻译图片', '翻訳画像をダウンロード', '번역 이미지 다운로드')}
                          </Button>
                        </a>
                        <DeleteHistoryButton id={item.id} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{tr('Ảnh gốc', 'Original image', '原图', '元画像', '원본 이미지')}</p>
                      <div className="relative aspect-[4/3] rounded-md overflow-hidden border bg-muted">
                        <ImagePreview
                          src={item.original_image_url}
                          alt={tr('Gốc', 'Original', '原图', '元画像', '원본')}
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
                          {tr('Tải ảnh gốc', 'Download original image', '下载原图', '元画像をダウンロード', '원본 이미지 다운로드')}
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
        <div className="section-surface text-center py-12 border-2 border-dashed rounded-lg">
          <h3 className="text-lg font-medium">{tr('Chưa có lịch sử dịch ảnh', 'No translation history yet', '暂无翻译记录', '翻訳履歴はまだありません', '번역 기록이 없습니다')}</h3>
          <p className="text-muted-foreground mt-1">{tr('Dịch ảnh tài liệu (1 ảnh, thư mục hoặc file Excel) để xem lịch sử tại đây.', 'Translate document images (single image, folder, or Excel file) to see history here.', '翻译文档图片（单图、文件夹或 Excel）后可在此查看历史。', '文書画像（単画像・フォルダ・Excel）を翻訳すると、ここに履歴が表示されます。', '문서 이미지(단일, 폴더, Excel)를 번역하면 이곳에서 기록을 볼 수 있습니다.')}</p>
          <Button className="mt-4" asChild>
            <Link href="/dich-anh-tai-lieu">{tr('Dịch ảnh ngay', 'Translate now', '立即翻译', '今すぐ翻訳', '지금 번역')}</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
