import { redirectToLogin } from '@/lib/auth/login-redirect'
import { pgListAllImageHistoryCompleted } from '@/lib/db/dashboard-user-pg'
import { getUserOrBypass } from '@/lib/auth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, ExternalLink, Images, Maximize2 } from 'lucide-react'
import { ImagePreview } from '@/components/ui/image-preview'
import { DownloadImageButton } from '@/components/download-image-button'
import { DeleteHistoryButton } from './delete-button'
import Link from 'next/link'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { normalizeTryOnHistoryInputImageUrl } from '@/lib/try-on-history-placeholder'
import { toolKeyToHref, tryOnFeatureToToolKey } from '@/lib/dashboard/task-hub'

export default async function HistoryPage() {
  const { t } = getServerDictionary()
  const locale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const history = await pgListAllImageHistoryCompleted(user.id)

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
      <div className="section-surface flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-[2rem] xl:text-4xl">
          {tr('Lịch sử xử lý ảnh', 'Image processing history', '图片处理记录', '画像処理履歴', '이미지 처리 기록')}
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <p className="text-muted-foreground">
            {historyRows.length || 0} {tr('kết quả', 'results', '条结果', '件', '개 결과')}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/tasks">{t.menu.tasksHub}</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/history/translate">{tr('Xem theo gói dịch', 'Translation batches', '翻译批次', '翻訳バッチ', '번역 묶음')}</Link>
          </Button>
        </div>
      </div>

      {historyRows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {historyRows.map((item) => {
            const toolKey = tryOnFeatureToToolKey(item.feature)
            const toolName = t.tool[toolKey]
            const toolHref = item.feature === 'translate' ? '/dashboard/history/translate' : toolKeyToHref(toolKey)
            const sourceImages = [
              {
                url: item.original_image_url,
                label: tr('Ảnh gốc', 'Original image', '原图', '元画像', '원본 이미지'),
              },
              {
                url: item.garment_image_url,
                label: tr('Ảnh tham chiếu', 'Reference image', '参考图', '参照画像', '참조 이미지'),
              },
            ].filter((source) => Boolean(source.url))

            return (
              <Card key={item.id} className="tool-tile overflow-hidden flex flex-col">
                <CardHeader className="p-4 pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-tight">{toolName}</h2>
                    <Badge variant="default">{tr('Hoàn thành', 'Completed', '已完成', '完了', '완료')}</Badge>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="mr-1 h-3 w-3" />
                    {new Date(item.created_at).toLocaleString(locale)}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-1 space-y-4">
                  <div className="space-y-2">
                    <div className="relative aspect-[4/3] rounded-md overflow-hidden border-2 border-primary bg-muted shadow-sm group">
                      <ImagePreview
                        src={item.result_image_url ?? ''}
                        alt={`${tr('Kết quả', 'Result', '结果', '結果', '결과')} - ${toolName}`}
                        className="w-full h-full"
                        printReadyAspectRatio={item.aspect_ratio ?? undefined}
                      />
                      <div className="absolute top-2 right-2 pointer-events-none">
                        <Badge className="bg-primary text-primary-foreground">{tr('Kết quả', 'Result', '结果', '結果', '결과')}</Badge>
                      </div>
                      <div className="absolute bottom-2 right-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <Badge variant="secondary" className="bg-black/50 text-white">
                          <Maximize2 className="w-3 h-3 mr-1" /> {tr('Xem to', 'Zoom', '放大查看', '拡大表示', '확대 보기')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DownloadImageButton
                          imageUrl={item.result_image_url ?? ''}
                          filename={`processed-${item.id}`}
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

                  {sourceImages.length > 0 ? (
                    <div className={`grid gap-2 ${sourceImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {sourceImages.map((source) => (
                        <div key={source.label} className="relative aspect-[4/3] rounded-md overflow-hidden border bg-muted group">
                          <ImagePreview
                            src={normalizeTryOnHistoryInputImageUrl(source.url)}
                            alt={source.label}
                            className="w-full h-full"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[10px] p-1 text-center pointer-events-none">
                            {source.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={toolHref}>
                      {tr('Mở công cụ', 'Open tool', '打开工具', 'ツールを開く', '도구 열기')}
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="section-surface text-center py-12 border-2 border-dashed rounded-lg">
          <Images className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
          <h3 className="text-lg font-medium">{tr('Chưa có lịch sử', 'No history yet', '暂无历史记录', '履歴はまだありません', '기록이 없습니다')}</h3>
          <p className="text-muted-foreground mt-1">
            {tr(
              'Kết quả từ mọi công cụ xử lý ảnh sẽ được lưu và hiển thị tại đây.',
              'Results from every image-processing tool will be saved and shown here.',
              '所有图片处理工具的结果都会保存在此处显示。',
              'すべての画像処理ツールの結果がここに保存・表示されます。',
              '모든 이미지 처리 도구의 결과가 여기에 저장되고 표시됩니다.'
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Button asChild>
              <Link href="/dashboard">{tr('Mở công cụ AI', 'Open AI tools', '打开 AI 工具', 'AIツールを開く', 'AI 도구 열기')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/history/translate">{tr('Xem theo gói dịch', 'Translation batches', '翻译批次', '翻訳バッチ', '번역 묶음')}</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}