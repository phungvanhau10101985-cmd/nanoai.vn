import { Suspense } from 'react'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ApiStatsDateFilter } from './api-stats-date-filter'
import { LogsTableWithDetail } from './logs-table-with-detail'
import { getCurrentWebLocale } from '@/lib/i18n/server'

/** Chi phí API - theo bảng giá Google Gemini 3 Pro Image 2025
 * Token output: 1K=1120, 2K=1120, 4K=2000. Giá ảnh: $120/1M tokens */
const IMAGE_TOKENS = { '1K': 1120, '2K': 1120, '4K': 2000 } as const
const API_COST_PER_1M: Record<string, { input: number; output: number; outputImage?: number }> = {
  'gemini-3-pro-image-preview': { input: 2, output: 12, outputImage: 120 },
  'gemini-3-flash-preview': { input: 0.5, output: 3 },
  'gemini-3-pro-preview': { input: 2, output: 12 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-preview-09-2025': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-flash-image': { input: 0.3, output: 30 }, // 1290 tok/image = $0.039
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
}
const USD_TO_VND = 25_000

function calcCostVnd(
  promptTokens: number,
  outputTokens: number,
  model: string,
  imageSize?: string | null
): number {
  const rates = API_COST_PER_1M[model] ?? API_COST_PER_1M['gemini-3-flash-preview']
  const isImage = imageSize === '1K' || imageSize === '2K' || imageSize === '4K'
  const outputRate = rates.outputImage && isImage ? rates.outputImage : rates.output
  // Dùng token cố định theo bảng Google khi có image_size (chính xác hơn)
  const effectiveOutputTokens =
    isImage && rates.outputImage && imageSize && imageSize in IMAGE_TOKENS
      ? IMAGE_TOKENS[imageSize as keyof typeof IMAGE_TOKENS]
      : outputTokens
  const usd = (promptTokens / 1_000_000) * rates.input + (effectiveOutputTokens / 1_000_000) * outputRate
  return Math.round(usd * USD_TO_VND)
}

const FEATURE_LABELS: Record<string, string> = {
  'thu-do-online': 'Thử đồ ảo',
  'thiet-ke-noi-ngoai-that': 'Thiết kế nội/ngoại thất',
  'xay-nha-tu-dat-nen': 'Nhà của bạn',
  'xay-nha-tu-dat-nen-synth': 'Xây nhà – tổng hợp prompt',
  'xay-nha-tu-dat-nen-structural': 'Xây nhà – bản vẽ kết cấu',
  'xay-nha-tu-dat-nen-floorplan': 'Xây nhà – bản vẽ chia phòng',
  'thiet-ke-noi-ngoai-that-analyze': 'Phân tích nội thất',
  'thiet-ke-noi-ngoai-that-process': 'Xử lý nội thất (dọn/staging)',
  'thiet-ke-logo': 'Thiết kế logo',
  'tao-anh-the': 'Tạo ảnh thẻ',
  'ghep-anh': 'Ghép ảnh',
  'lam-net-anh': 'Làm nét ảnh',
  'lam-dep-anh': 'Làm đẹp ảnh',
  'tao-banner': 'Tạo banner',
  'tao-nhan-gioi-thieu-san-pham': 'Tạo nhãn giới thiệu sản phẩm',
  'phuc-dung-anh': 'Phục dựng ảnh',
  'che-anh': 'Chế ảnh',
  'xoa-vat-the': 'Xóa vật thể',
  'thay-nen-san-pham': 'Thay nền sản phẩm',
  'tao-anh-chain-dung': 'Ảnh chân dung',
  'mo-rong-khung-hinh': 'Mở rộng khung hình',
  'hoan-doi-khuon-mat': 'Hoán đổi khuôn mặt',
  'tao-anh-3d': 'Ảnh 3D mockup',
  'tao-mo-hinh-3d-tu-anh': 'Mô hình 3D từ ảnh',
  'tao-video-tu-anh': 'Tạo video từ ảnh',
  'ai-normalize': 'Chuẩn hóa văn bản (AI)',
  'dich-anh-tai-lieu': 'Dịch ảnh tài liệu',
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function AdminApiStatsPage({
  searchParams = {},
}: {
  searchParams?: { from?: string; to?: string }
}) {
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const params = searchParams ?? {}

  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const fromParam = params.from?.trim()
  const toParam = params.to?.trim()
  const fromDate = fromParam || toYMD(thirtyDaysAgo)
  const toDate = toParam || toYMD(today)

  const rangeStart = new Date(fromDate)
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(toDate)
  rangeEnd.setHours(23, 59, 59, 999)

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: allPayments } = await adminSupabase
    .from('payments')
    .select('amount, completed_at, created_at')
    .eq('status', 'completed')

  const revenueInRange =
    allPayments
      ?.filter((p) => {
        const d = (p as { completed_at?: string; created_at?: string }).completed_at ?? (p as { created_at?: string }).created_at
        if (!d) return false
        const dt = new Date(d)
        return dt >= rangeStart && dt <= rangeEnd
      })
      .reduce((s, p) => s + (p.amount || 0), 0) ?? 0

  const { data: logs, error } = await adminSupabase
    .from('api_usage_log')
    .select('id, model, feature, prompt_token_count, candidates_token_count, total_token_count, image_size, created_at')
    .gte('created_at', fromDate + 'T00:00:00')
    .lte('created_at', toDate + 'T23:59:59.999')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight">{tr('Thống kê API', 'API statistics', 'API 统计', 'API統計', 'API 통계')}</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{tr('Lỗi', 'Error', '错误', 'エラー', '오류')}: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const logsList = logs || []

  const byModel = logsList.reduce(
    (acc, log) => {
      const key = log.model
      if (!acc[key]) {
        acc[key] = { calls: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0, costVnd: 0, calls2K: 0, calls4K: 0, callsNoImage: 0 }
      }
      acc[key].calls += 1
      acc[key].promptTokens += log.prompt_token_count || 0
      acc[key].outputTokens += log.candidates_token_count || 0
      acc[key].totalTokens += log.total_token_count || 0
      const imgSize = (log as { image_size?: string | null }).image_size
      acc[key].costVnd += calcCostVnd(log.prompt_token_count || 0, log.candidates_token_count || 0, log.model, imgSize)
      if (imgSize === '2K') acc[key].calls2K += 1
      else if (imgSize === '4K') acc[key].calls4K += 1
      else acc[key].callsNoImage += 1
      return acc
    },
    {} as Record<string, { calls: number; promptTokens: number; outputTokens: number; totalTokens: number; costVnd: number; calls2K: number; calls4K: number; callsNoImage: number }>
  )

  const byFeature = logsList.reduce(
    (acc, log) => {
      const key = log.feature
      if (!acc[key]) {
        acc[key] = { calls: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0, costVnd: 0, calls2K: 0, calls4K: 0, callsNoImage: 0 }
      }
      acc[key].calls += 1
      acc[key].promptTokens += log.prompt_token_count || 0
      acc[key].outputTokens += log.candidates_token_count || 0
      acc[key].totalTokens += log.total_token_count || 0
      const imgSize = (log as { image_size?: string | null }).image_size
      acc[key].costVnd += calcCostVnd(log.prompt_token_count || 0, log.candidates_token_count || 0, log.model, imgSize)
      if (imgSize === '2K') acc[key].calls2K += 1
      else if (imgSize === '4K') acc[key].calls4K += 1
      else acc[key].callsNoImage += 1
      return acc
    },
    {} as Record<string, { calls: number; promptTokens: number; outputTokens: number; totalTokens: number; costVnd: number; calls2K: number; calls4K: number; callsNoImage: number }>
  )

  const byImageSize = logsList.reduce(
    (acc, log) => {
      const imgSize = (log as { image_size?: string | null }).image_size
      const key = imgSize === '2K' ? '2K' : imgSize === '4K' ? '4K' : 'no-image'
      if (!acc[key]) {
        acc[key] = { calls: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0, costVnd: 0 }
      }
      acc[key].calls += 1
      acc[key].promptTokens += log.prompt_token_count || 0
      acc[key].outputTokens += log.candidates_token_count || 0
      acc[key].totalTokens += log.total_token_count || 0
      acc[key].costVnd += calcCostVnd(
        log.prompt_token_count || 0,
        log.candidates_token_count || 0,
        log.model,
        (log as { image_size?: string | null }).image_size
      )
      return acc
    },
    {} as Record<string, { calls: number; promptTokens: number; outputTokens: number; totalTokens: number; costVnd: number }>
  )

  const totals = {
    calls: logsList.length,
    promptTokens: logsList.reduce((s, l) => s + (l.prompt_token_count || 0), 0),
    outputTokens: logsList.reduce((s, l) => s + (l.candidates_token_count || 0), 0),
    totalTokens: logsList.reduce((s, l) => s + (l.total_token_count || 0), 0),
  }

  let apiCostUsdInRange = 0
  for (const log of logsList) {
    const cost = calcCostVnd(
      log.prompt_token_count || 0,
      log.candidates_token_count || 0,
      log.model,
      (log as { image_size?: string | null }).image_size
    )
    apiCostUsdInRange += cost / USD_TO_VND
  }
  const apiCostVndInRange = Math.round(apiCostUsdInRange * USD_TO_VND)
  const profitInRange = revenueInRange - apiCostVndInRange

  const formatNum = (n: number) => n.toLocaleString('vi-VN')
  const formatVnd = (n: number) => `${n.toLocaleString('vi-VN')}₫`

  const rangeLabel = fromDate === toDate
    ? new Date(fromDate).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : `${new Date(fromDate).toLocaleDateString('vi-VN')} – ${new Date(toDate).toLocaleDateString('vi-VN')}`

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{tr('Thống kê sử dụng API Google (Gemini)', 'Google API usage statistics (Gemini)', 'Google API 使用统计（Gemini）', 'Google API利用統計（Gemini）', 'Google API 사용 통계 (Gemini)')}</h2>
        <p className="text-muted-foreground mt-1">{tr('Tối đa 5000 bản ghi • Tỷ giá 1 USD = 25.000₫', 'Up to 5000 records • Exchange rate: 1 USD = 25,000₫', '最多5000条记录 • 汇率：1 USD = 25,000₫', '最大5000件 • 為替レート: 1 USD = 25,000₫', '최대 5000건 • 환율: 1 USD = 25,000₫')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {tr(
            'Giá theo bảng Google 2025: pro-image $2/$120 input/output, flash $0.5/$3, 2.5-flash $0.3/$2.5, 2.0-flash $0.1/$0.4',
            'Pricing by Google 2025 table: pro-image $2/$120 input/output, flash $0.5/$3, 2.5-flash $0.3/$2.5, 2.0-flash $0.1/$0.4',
            '按 Google 2025 定价：pro-image $2/$120 输入/输出，flash $0.5/$3，2.5-flash $0.3/$2.5，2.0-flash $0.1/$0.4',
            'Google 2025価格表: pro-image $2/$120 input/output, flash $0.5/$3, 2.5-flash $0.3/$2.5, 2.0-flash $0.1/$0.4',
            'Google 2025 요금표: pro-image $2/$120 입력/출력, flash $0.5/$3, 2.5-flash $0.3/$2.5, 2.0-flash $0.1/$0.4'
          )}
        </p>
      </div>

      <Suspense fallback={<Card className="border-slate-200"><CardContent className="py-4">{tr('Đang tải bộ lọc...', 'Loading filters...', '正在加载筛选器...', 'フィルターを読み込み中...', '필터 불러오는 중...')}</CardContent></Card>}>
        <ApiStatsDateFilter key={`${fromDate}-${toDate}`} defaultFrom={fromDate} defaultTo={toDate} />
      </Suspense>

      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader>
          <CardTitle>{tr('Thu chi & lợi nhuận', 'Revenue, cost & profit', '收支与利润', '収支と利益', '수익/비용/이익')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {rangeLabel}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tr('Thu (doanh thu)', 'Revenue', '收入', '収入', '매출')}</p>
              <p className="text-2xl font-bold text-emerald-700">{formatVnd(revenueInRange)}</p>
              <p className="text-xs text-muted-foreground">{tr('Từ thanh toán nạp credits', 'From top-up payments', '来自充值支付', 'チャージ決済から', '충전 결제에서')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tr('Chi (API)', 'Cost (API)', '支出 (API)', 'コスト (API)', '비용 (API)')}</p>
              <p className="text-2xl font-bold text-amber-700">{formatVnd(apiCostVndInRange)}</p>
              <p className="text-xs text-muted-foreground">
                ~{apiCostUsdInRange.toFixed(4)} USD • {logsList.length} {tr('lượt gọi', 'calls', '次调用', '回', '회 호출')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tr('Lợi nhuận', 'Profit', '利润', '利益', '이익')}</p>
              <p className={`text-2xl font-bold ${profitInRange >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatVnd(profitInRange)}
              </p>
              <p className="text-xs text-muted-foreground">{tr('Thu − Chi', 'Revenue − Cost', '收入 − 支出', '収入 − コスト', '매출 − 비용')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{tr('Tổng lượt gọi', 'Total calls', '总调用次数', '総呼び出し数', '총 호출 수')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNum(totals.calls)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Input tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNum(totals.promptTokens)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Output tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNum(totals.outputTokens)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{tr('Tổng tokens', 'Total tokens', '总 tokens', '合計 tokens', '총 tokens')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNum(totals.totalTokens)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tr('Theo model', 'By model', '按模型', 'モデル別', '모델별')}</CardTitle>
            <p className="text-sm text-muted-foreground">{tr('Số lượt gọi và token theo từng model', 'Calls and tokens by model', '按模型统计调用和 tokens', 'モデルごとの呼び出しとtokens', '모델별 호출 및 tokens')}</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">{tr('Lượt gọi', 'Calls', '调用次数', '呼び出し回数', '호출 수')}</TableHead>
                  <TableHead className="text-right">2K</TableHead>
                  <TableHead className="text-right">4K</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">{tr('Tổng', 'Total', '总计', '合計', '합계')}</TableHead>
                  <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(byModel)
                  .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
                  .map(([model, stats]) => (
                    <TableRow key={model}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {model}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatNum(stats.calls)}</TableCell>
                      <TableCell className="text-right text-sky-600">{formatNum(stats.calls2K)}</TableCell>
                      <TableCell className="text-right text-amber-600">{formatNum(stats.calls4K)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.promptTokens)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.outputTokens)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNum(stats.totalTokens)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-amber-700">{formatVnd(stats.costVnd)}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">~{formatVnd(stats.calls ? Math.round(stats.costVnd / stats.calls) : 0)}/{tr('lượt', 'call', '次', '回', '회')}</span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr('Theo chức năng', 'By feature', '按功能', '機能別', '기능별')}</CardTitle>
            <p className="text-sm text-muted-foreground">{tr('Số lượt gọi và token theo từng tính năng', 'Calls and tokens by feature', '按功能统计调用和 tokens', '機能ごとの呼び出しとtokens', '기능별 호출 및 tokens')}</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('Chức năng', 'Feature', '功能', '機能', '기능')}</TableHead>
                  <TableHead className="text-right">{tr('Lượt gọi', 'Calls', '调用次数', '呼び出し回数', '호출 수')}</TableHead>
                  <TableHead className="text-right">2K</TableHead>
                  <TableHead className="text-right">4K</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">{tr('Tổng', 'Total', '总计', '合計', '합계')}</TableHead>
                  <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(byFeature)
                  .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
                  .map(([feature, stats]) => (
                    <TableRow key={feature}>
                      <TableCell>
                        <span className="font-medium">{FEATURE_LABELS[feature] || feature}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{feature}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatNum(stats.calls)}</TableCell>
                      <TableCell className="text-right text-sky-600">{formatNum(stats.calls2K)}</TableCell>
                      <TableCell className="text-right text-amber-600">{formatNum(stats.calls4K)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.promptTokens)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.outputTokens)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNum(stats.totalTokens)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-amber-700">{formatVnd(stats.costVnd)}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">~{formatVnd(stats.calls ? Math.round(stats.costVnd / stats.calls) : 0)}/{tr('lượt', 'call', '次', '回', '회')}</span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tr('Theo độ phân giải ảnh', 'By image resolution', '按图像分辨率', '画像解像度別', '이미지 해상도별')}</CardTitle>
          <p className="text-sm text-muted-foreground">{tr('Số lượt gọi trả ảnh 2K, 4K hoặc không trả ảnh (chỉ text)', 'Calls returning 2K, 4K images or no image (text only)', '返回2K、4K图片或不返回图片（仅文本）的调用次数', '2K/4K画像返却または画像なし（テキストのみ）の呼び出し', '2K/4K 이미지 반환 또는 이미지 없음(텍스트만) 호출 수')}</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('Ảnh trả về', 'Returned image', '返回图片', '返却画像', '반환 이미지')}</TableHead>
                <TableHead className="text-right">{tr('Lượt gọi', 'Calls', '调用次数', '呼び出し回数', '호출 수')}</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">{tr('Tổng', 'Total', '总计', '合計', '합계')}</TableHead>
                <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(['2K', '4K', 'no-image'] as const).map((key) => {
                const label = key === '2K' ? '2K' : key === '4K' ? '4K' : tr('Không trả ảnh', 'No image', '无图片', '画像なし', '이미지 없음')
                const stats = byImageSize[key]
                if (!stats || stats.calls === 0) return null
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <Badge variant={key === 'no-image' ? 'secondary' : 'outline'} className={key === '2K' ? 'text-sky-600 border-sky-300' : key === '4K' ? 'text-amber-600 border-amber-300' : ''}>
                        {label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNum(stats.calls)}</TableCell>
                    <TableCell className="text-right">{formatNum(stats.promptTokens)}</TableCell>
                    <TableCell className="text-right">{formatNum(stats.outputTokens)}</TableCell>
                    <TableCell className="text-right font-medium">{formatNum(stats.totalTokens)}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-amber-700">{formatVnd(stats.costVnd)}</span>
                      <br />
                      <span className="text-xs text-muted-foreground">~{formatVnd(stats.calls ? Math.round(stats.costVnd / stats.calls) : 0)}/{tr('lượt', 'call', '次', '回', '회')}</span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('Chi tiết gần đây', 'Recent details', '最近明细', '最近の詳細', '최근 상세')}</CardTitle>
          <p className="text-sm text-muted-foreground">{tr('100 bản ghi mới nhất • Bấm vào dòng để xem chi tiết lượt gọi', 'Latest 100 records • Click row to view call details', '最新100条记录 • 点击行查看调用详情', '最新100件 • 行をクリックして詳細を表示', '최신 100건 • 행을 클릭해 상세 보기')}</p>
        </CardHeader>
        <CardContent>
          {logsList.length > 0 ? (
            <LogsTableWithDetail
              logs={logsList.slice(0, 100).map((log) => ({
                ...log,
                costVnd: calcCostVnd(
                  log.prompt_token_count || 0,
                  log.candidates_token_count || 0,
                  log.model,
                  (log as { image_size?: string | null }).image_size
                ),
              }))}
              featureLabels={FEATURE_LABELS}
            />
          ) : (
            <p className="py-8 text-center text-muted-foreground">{tr('Chưa có dữ liệu thống kê.', 'No statistics data yet.', '暂无统计数据。', '統計データがありません。', '통계 데이터가 없습니다.')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
