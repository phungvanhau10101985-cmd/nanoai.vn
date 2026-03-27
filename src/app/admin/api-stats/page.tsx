import Link from 'next/link'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ApiStatsDateFilter } from './api-stats-date-filter'
import { LogsTableWithDetail } from './logs-table-with-detail'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { isEnglishCoachApiUsageFeature } from '@/lib/english-coach-api-usage'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { calcCostVnd, USD_TO_VND } from './api-cost'
import { buildEnglishCoachFeatureLabelsForLogs, ENGLISH_COACH_API_STATS_FEATURE_LABELS } from './english-coach-feature-labels'
import { CURRICULUM_API_STATS_FEATURE_LABELS } from './curriculum-feature-labels'
import {
  aggregateEnglishCoachApiCostByLessonKind,
  aggregateLanguageCoachCredits,
} from './language-coach-financials'

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
  ...ENGLISH_COACH_API_STATS_FEATURE_LABELS,
  ...CURRICULUM_API_STATS_FEATURE_LABELS,
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

  const [{ data: logs, error }, { data: languageCoachCreditEvents }] = await Promise.all([
    adminSupabase
      .from('api_usage_log')
      .select('id, model, feature, prompt_token_count, candidates_token_count, total_token_count, image_size, created_at')
      .gte('created_at', fromDate + 'T00:00:00')
      .lte('created_at', toDate + 'T23:59:59.999')
      .order('created_at', { ascending: false })
      .limit(5000),
    adminSupabase
      .from('language_coach_credit_events')
      .select('charge_type, amount')
      .gte('created_at', fromDate + 'T00:00:00')
      .lte('created_at', toDate + 'T23:59:59.999'),
  ])

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
  const coachLogsInRange = logsList.filter((l) => isEnglishCoachApiUsageFeature(l.feature))
  const languageCoachCreditAgg = aggregateLanguageCoachCredits(languageCoachCreditEvents || [])
  const coachApiByKind = aggregateEnglishCoachApiCostByLessonKind(coachLogsInRange)
  const featureLabelsMerged = {
    ...FEATURE_LABELS,
    ...buildEnglishCoachFeatureLabelsForLogs(coachLogsInRange.map((l) => l.feature)),
  }

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
        <p className="text-sm mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/admin/api-stats/english-coach" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {tr(
              'Báo cáo riêng: Học ngoại ngữ AI (english-coach)',
              'Separate report: Language coach AI (english-coach)',
              '单独报表：外语学习 AI（english-coach）',
              '別レポート：語学学習AI（english-coach）',
              '별도 보고서: 외국어 학습 AI (english-coach)'
            )}
          </Link>
          <Link href="/admin/api-stats/curriculum" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {tr(
              'Báo cáo chi tiết: Tạo giáo trình (curriculum-)',
              'Detailed report: Curriculum builder (curriculum-)',
              '详细报表：创建课程（curriculum-）',
              '詳細レポート：授業作成（curriculum-）',
              '상세 보고서: 교안 만들기 (curriculum-)'
            )}
          </Link>
        </p>
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

      <ApiStatsDateFilter key={`${fromDate}-${toDate}`} defaultFrom={fromDate} defaultTo={toDate} />

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

      <Card className="border-indigo-200 bg-indigo-50/20">
        <CardHeader>
          <CardTitle>
            {tr(
              'Học ngoại ngữ AI — Credit đã thu & chi phí API Gemini',
              'Language coach — credits collected & Gemini API cost',
              '外语学习 AI — 已收积分与 Gemini API',
              '語学コーチ — クレジット収入とGemini API',
              '외국어 코치 — 크레딧·Gemini API'
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          <p className="text-xs text-muted-foreground">
            {tr(
              'Quy đổi credit → VND theo',
              'Credit → VND using',
              '积分换算 VND：',
              'クレジット→VND:',
              '크레딧→VND:'
            )}{' '}
            1 credit = {CREDIT_UNIT_PRICE_VND.toLocaleString('vi-VN')}₫.{' '}
            {tr(
              'Chi phí API “buổi live” chỉ gồm bản ghi feature english-coach-live-*; “bài có sẵn” là english-coach-preset-*.',
              '“Live” API cost counts only english-coach-live-* features; “preset” counts english-coach-preset-*.',
              '“直播”API 仅计 english-coach-live-*；“现成课”计 english-coach-preset-*。',
              'ライブAPIは english-coach-live-* のみ。プリセットは english-coach-preset-*。',
              '라이브 API는 english-coach-live-*만. 프리셋은 english-coach-preset-*.'
            )}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {tr('Thu credit — buổi live', 'Credits — live', '积分—直播', 'クレジット—ライブ', '크레딧—라이브')}
              </p>
              <p className="text-xl font-bold text-emerald-800">{formatVnd(languageCoachCreditAgg.liveCreditsVnd)}</p>
              <p className="text-xs text-muted-foreground">
                {languageCoachCreditAgg.liveCredits.toFixed(2)} credits • {formatNum(languageCoachCreditAgg.liveStartCount)}+{formatNum(languageCoachCreditAgg.liveUnlockCount)}{' '}
                {tr('lần mở', 'charges', '次', '回', '건')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {tr('Thu credit — bài có sẵn', 'Credits — preset', '积分—现成课', 'クレジット—プリセット', '크레딧—프리셋')}
              </p>
              <p className="text-xl font-bold text-violet-900">{formatVnd(languageCoachCreditAgg.presetCreditsVnd)}</p>
              <p className="text-xs text-muted-foreground">
                {languageCoachCreditAgg.presetCredits.toFixed(2)} credits • {formatNum(languageCoachCreditAgg.presetStartCount)}{' '}
                {tr('lần mở', 'starts', '次', '回', '건')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {tr('Chi API Gemini — buổi live', 'Gemini cost — live', 'Gemini—直播', 'Gemini—ライブ', 'Gemini—라이브')}
              </p>
              <p className="text-xl font-bold text-amber-700">{formatVnd(coachApiByKind.liveVnd)}</p>
              <p className="text-xs text-muted-foreground">~{coachApiByKind.liveUsd.toFixed(4)} USD</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {tr('Chi API — bài có sẵn', 'API cost — preset', 'API—现成课', 'API—プリセット', 'API—프리셋')}
              </p>
              <p className="text-xl font-bold text-slate-700">{formatVnd(coachApiByKind.presetVnd)}</p>
              <p className="text-xs text-muted-foreground">~{coachApiByKind.presetUsd.toFixed(4)} USD</p>
            </div>
          </div>
          {coachApiByKind.legacyVnd > 0 ? (
            <p className="text-xs text-amber-800 mt-3 border-t pt-3">
              {tr(
                'Chi API english-coach chưa gắn nhãn live/preset (log cũ):',
                'Unlabeled english-coach API (legacy logs):',
                '未标注的 english-coach API（旧日志）：',
                '未分類の english-coach API（旧ログ）:',
                '미분류 english-coach API(구 로그):'
              )}{' '}
              {formatVnd(coachApiByKind.legacyVnd)} (~{coachApiByKind.legacyUsd.toFixed(4)} USD)
            </p>
          ) : null}
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
                        <span className="font-medium">{featureLabelsMerged[feature] || feature}</span>
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
              featureLabels={featureLabelsMerged}
            />
          ) : (
            <p className="py-8 text-center text-muted-foreground">{tr('Chưa có dữ liệu thống kê.', 'No statistics data yet.', '暂无统计数据。', '統計データがありません。', '통계 데이터가 없습니다.')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
