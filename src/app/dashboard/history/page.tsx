import { redirectToLogin } from '@/lib/auth/login-redirect'
import { pgListTryOnHistoryCompletedExcludeTranslate } from '@/lib/db/dashboard-user-pg'
import { getUserOrBypass } from '@/lib/auth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Maximize2 } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'

// Client component for image preview
import { ImagePreview } from '@/components/ui/image-preview'
import { DownloadImageButton } from '@/components/download-image-button'
import { DeleteHistoryButton } from './delete-button'
import Link from 'next/link'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { normalizeTryOnHistoryInputImageUrl } from '@/lib/try-on-history-placeholder'

export default async function HistoryPage() {
  const { t } = getServerDictionary()
  const locale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const history = await pgListTryOnHistoryCompletedExcludeTranslate(user.id)

  type HistoryRow = {
    id: string
    created_at: string
    status: string
    result_image_url?: string | null
    original_image_url?: string | null
    garment_image_url?: string | null
    feature?: string | null
    aspect_ratio?: string | null
  }
  const historyRows = (history ?? []) as HistoryRow[]

  return (
    <div className="app-shell space-y-6 md:space-y-8 lg:space-y-8 xl:space-y-10">
      <Toaster />
      <div className="section-surface flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-[2rem] xl:text-4xl">
          {tr('Ảnh đã xử lý', 'Processed images', '已处理图片', '処理済み画像', '처리된 이미지')}
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <p className="text-muted-foreground">
            {historyRows.length || 0} {tr('kết quả', 'results', '条结果', '件', '개 결과')}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/tasks">{t.menu.tasksHub}</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/history/translate">{tr('Lịch sử dịch ảnh', 'Translation history', '翻译记录', '翻訳履歴', '번역 기록')}</Link>
          </Button>
        </div>
      </div>

      {historyRows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {historyRows.map((item) => (
            <Card key={item.id} className="tool-tile overflow-hidden flex flex-col">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-1 h-3 w-3" />
                  {new Date(item.created_at).toLocaleDateString('vi-VN')}
                </div>
                <Badge variant={item.status === 'completed' ? 'default' : 'destructive'}>
                  {item.status === 'completed' ? tr('Thành công', 'Success', '成功', '成功', '성공') : tr('Thất bại', 'Failed', '失败', '失敗', '실패')}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 flex-1 space-y-4">
                {item.result_image_url && (
                  <div className="space-y-2">
                    <div className="relative aspect-[3/4] rounded-md overflow-hidden border-2 border-primary shadow-sm group">
<ImagePreview
                        src={item.result_image_url}
                        alt="Result"
                        className="w-full h-full"
                        printReadyAspectRatio={item.aspect_ratio ?? undefined}
                      />
                      <div className="absolute top-2 right-2 pointer-events-none">
                        <Badge className="bg-primary text-primary-foreground">{tr('Kết quả', 'Result', '结果', '結果', '결과')}</Badge>
                      </div>
                      <div className="absolute bottom-2 right-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/70">
                          <Maximize2 className="w-3 h-3 mr-1" /> {tr('Xem to', 'Zoom', '放大查看', '拡大表示', '확대 보기')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DownloadImageButton
                          imageUrl={item.result_image_url}
                          filename={`try-on-${item.id}`}
                          size="sm"
                          variant="default"
                          className="w-full"
                          printReady
                          printReadyAspectRatio={item.aspect_ratio ?? undefined}
                          printReadyInferFromImage={!item.aspect_ratio}
                          printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                          printReadySuccessToast={tr('Đã tạo PDF chuẩn in. Bleed 3mm, crop marks.', 'Print-ready PDF created. Bleed 3mm, crop marks.', '已生成印刷用PDF。出血3mm，裁切线。', '印刷用PDFを作成しました。塗り足し3mm、トンボ付き。', '인쇄용 PDF 생성됨. 블리드 3mm, 크롭 마크.')}
                        />
                      </div>
                      <div className="w-24">
                        <DeleteHistoryButton id={item.id} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative aspect-[3/4] rounded-md overflow-hidden border bg-muted group">
                    <ImagePreview
                      src={normalizeTryOnHistoryInputImageUrl(item.original_image_url)}
                      alt="Original"
                      className="w-full h-full"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 text-center pointer-events-none">
                      {tr('Ảnh gốc', 'Original image', '原图', '元画像', '원본 이미지')}
                    </div>
                    <div className="absolute top-1 right-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 text-white p-1 rounded-full">
                        <Maximize2 className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                  <div className="relative aspect-[3/4] rounded-md overflow-hidden border bg-muted group">
                    <ImagePreview
                      src={normalizeTryOnHistoryInputImageUrl(item.garment_image_url)}
                      alt="Garment"
                      className="w-full h-full"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 text-center pointer-events-none">
                      {tr('Sản phẩm', 'Garment', '服装', '衣装', '의류')}
                    </div>
                    <div className="absolute top-1 right-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 text-white p-1 rounded-full">
                        <Maximize2 className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              {/* <CardFooter className="p-4 pt-0">
                {item.result_image_url && (
                  <a href={item.result_image_url} download={`try-on-${item.id}.png`} className="w-full" target="_blank" rel="noopener noreferrer">
                    <Button className="w-full" variant="outline">
                      <Download className="mr-2 h-4 w-4" /> Tải ảnh về
                    </Button>
                  </a>
                )}
              </CardFooter> */}
            </Card>
          ))}
        </div>
      ) : (
        <div className="section-surface text-center py-12 border-2 border-dashed rounded-lg">
          <h3 className="text-lg font-medium">{tr('Chưa có lịch sử', 'No history yet', '暂无历史记录', '履歴はまだありません', '기록이 없습니다')}</h3>
          <p className="text-muted-foreground mt-1">{tr('Hãy thử các tính năng thử đồ, phục dựng ảnh, làm nét, ghép ảnh ngay bây giờ!', 'Try virtual try-on, restoration, sharpen, and merge features now!', '快去试试试衣、修复、清晰化和拼图功能吧！', '試着・復元・高画質化・合成機能を今すぐ試してみましょう！', '가상 피팅, 복원, 선명화, 합성 기능을 지금 사용해 보세요!')}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Button asChild>
              <a href="/thu-do-online">{tr('Thử đồ ngay', 'Try on now', '立即试衣', '今すぐ試着', '지금 피팅하기')}</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/dashboard/history/translate">{tr('Lịch sử dịch ảnh', 'Translation history', '翻译记录', '翻訳履歴', '번역 기록')}</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}