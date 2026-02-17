import { Suspense } from 'react'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ApiStatsDateFilter } from './api-stats-date-filter'
import { LogsTableWithDetail } from './logs-table-with-detail'

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
        <h2 className="text-3xl font-bold tracking-tight">Thống kê API</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Lỗi: {error.message}</p>
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
        <h2 className="text-3xl font-bold tracking-tight">Thống kê sử dụng API Google (Gemini)</h2>
        <p className="text-muted-foreground mt-1">Tối đa 5000 bản ghi • Tỷ giá 1 USD = 25.000₫</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Giá theo bảng Google 2025: pro-image $2/$120 input/output, flash $0.5/$3, 2.5-flash $0.3/$2.5, 2.0-flash $0.1/$0.4
        </p>
      </div>

      <Suspense fallback={<Card className="border-slate-200"><CardContent className="py-4">Đang tải bộ lọc...</CardContent></Card>}>
        <ApiStatsDateFilter key={`${fromDate}-${toDate}`} defaultFrom={fromDate} defaultTo={toDate} />
      </Suspense>

      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader>
          <CardTitle>Thu chi &amp; lợi nhuận</CardTitle>
          <p className="text-sm text-muted-foreground">
            {rangeLabel}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Thu (doanh thu)</p>
              <p className="text-2xl font-bold text-emerald-700">{formatVnd(revenueInRange)}</p>
              <p className="text-xs text-muted-foreground">Từ thanh toán nạp credits</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Chi (API)</p>
              <p className="text-2xl font-bold text-amber-700">{formatVnd(apiCostVndInRange)}</p>
              <p className="text-xs text-muted-foreground">
                ~{apiCostUsdInRange.toFixed(4)} USD • {logsList.length} lượt gọi
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Lợi nhuận</p>
              <p className={`text-2xl font-bold ${profitInRange >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatVnd(profitInRange)}
              </p>
              <p className="text-xs text-muted-foreground">Thu − Chi</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tổng lượt gọi</CardTitle>
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
            <CardTitle className="text-sm font-medium">Tổng tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNum(totals.totalTokens)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Theo model</CardTitle>
            <p className="text-sm text-muted-foreground">Số lượt gọi và token theo từng model</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Lượt gọi</TableHead>
                  <TableHead className="text-right">2K</TableHead>
                  <TableHead className="text-right">4K</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead className="text-right">Chi phí (₫)</TableHead>
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
                        <span className="text-xs text-muted-foreground">~{formatVnd(stats.calls ? Math.round(stats.costVnd / stats.calls) : 0)}/lượt</span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Theo chức năng</CardTitle>
            <p className="text-sm text-muted-foreground">Số lượt gọi và token theo từng tính năng</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chức năng</TableHead>
                  <TableHead className="text-right">Lượt gọi</TableHead>
                  <TableHead className="text-right">2K</TableHead>
                  <TableHead className="text-right">4K</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead className="text-right">Chi phí (₫)</TableHead>
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
                        <span className="text-xs text-muted-foreground">~{formatVnd(stats.calls ? Math.round(stats.costVnd / stats.calls) : 0)}/lượt</span>
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
          <CardTitle>Theo độ phân giải ảnh</CardTitle>
          <p className="text-sm text-muted-foreground">Số lượt gọi trả ảnh 2K, 4K hoặc không trả ảnh (chỉ text)</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ảnh trả về</TableHead>
                <TableHead className="text-right">Lượt gọi</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Chi phí (₫)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(['2K', '4K', 'no-image'] as const).map((key) => {
                const label = key === '2K' ? '2K' : key === '4K' ? '4K' : 'Không trả ảnh'
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
                      <span className="text-xs text-muted-foreground">~{formatVnd(stats.calls ? Math.round(stats.costVnd / stats.calls) : 0)}/lượt</span>
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
          <CardTitle>Chi tiết gần đây</CardTitle>
          <p className="text-sm text-muted-foreground">100 bản ghi mới nhất • Bấm vào dòng để xem chi tiết lượt gọi</p>
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
            <p className="py-8 text-center text-muted-foreground">Chưa có dữ liệu thống kê.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
