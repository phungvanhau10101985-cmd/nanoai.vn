import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ApiStatsDateFilter } from './api-stats-date-filter'
import { LogsTableWithDetail } from './logs-table-with-detail'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { isEnglishCoachApiUsageFeature } from '@/lib/english-coach-api-usage'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { calcCostVnd, USD_TO_VND } from './api-cost'
import { mergeApiFeatureLabelsForLogs } from './api-stats-labels'
import {
  aggregateEnglishCoachApiCostByLessonKind,
  aggregateLanguageCoachCredits,
} from './language-coach-financials'
import { fetchAllApiUsageLogsInRange, sortApiUsageLogsNewestFirst } from './fetch-api-usage-logs-range'
import { ApiUsageCharts } from './api-usage-charts'
import { buildApiUsageChartData } from './build-api-usage-chart-data'
import { getApiUsageModelDisplayLabel } from './model-display-label'
import {
  fetchLanguageCoachCreditEventsInRange,
  fetchMessagingPartnerTokenUsageByShopModelInRange,
  fetchRevenueFromCompletedPaymentsInRange,
} from '@/lib/db/admin-api-stats-pg'

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

  const fromIso = fromDate + 'T00:00:00'
  const toIso = toDate + 'T23:59:59.999'

  const [logFetch, revenueInRange, languageCoachCreditEvents, shopTokenRowsByModel] = await Promise.all([
    fetchAllApiUsageLogsInRange(fromIso, toIso),
    fetchRevenueFromCompletedPaymentsInRange(fromIso, toIso),
    fetchLanguageCoachCreditEventsInRange(fromIso, toIso),
    fetchMessagingPartnerTokenUsageByShopModelInRange(fromIso, toIso),
  ])

  const { data: logsRaw, error } = logFetch

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

  const logsList = sortApiUsageLogsNewestFirst(logsRaw || [])
  const coachLogsInRange = logsList.filter((l) => isEnglishCoachApiUsageFeature(l.feature))
  const languageCoachCreditAgg = aggregateLanguageCoachCredits(languageCoachCreditEvents || [])
  const coachApiByKind = aggregateEnglishCoachApiCostByLessonKind(coachLogsInRange)
  const featureLabelsMerged = mergeApiFeatureLabelsForLogs(logsList.map((l) => l.feature))

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

  const byShopTokenMap = shopTokenRowsByModel.reduce(
    (acc, row) => {
      const key = row.partner_id
      if (!acc[key]) {
        acc[key] = {
          partnerId: row.partner_id,
          partnerSlug: row.partner_slug,
          partnerName: row.partner_display_name,
          ownerEmail: row.owner_email,
          calls: 0,
          promptTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costVnd: 0,
          models: new Set<string>(),
        }
      }
      const current = acc[key]
      current.calls += row.call_count
      current.promptTokens += row.sum_prompt_tokens
      current.outputTokens += row.sum_completion_tokens
      current.totalTokens += row.sum_total_tokens
      current.models.add(row.model)
      current.costVnd += calcCostVnd(row.sum_prompt_tokens, row.sum_completion_tokens, row.model, null, {
        pricingMode: 'aggregate_short',
      })
      return acc
    },
    {} as Record<
      string,
      {
        partnerId: string
        partnerSlug: string
        partnerName: string
        ownerEmail: string | null
        calls: number
        promptTokens: number
        outputTokens: number
        totalTokens: number
        costVnd: number
        models: Set<string>
      }
    >
  )

  const byShopToken = Object.values(byShopTokenMap)
    .map((x) => ({ ...x, modelCount: x.models.size }))
    .sort((a, b) => b.totalTokens - a.totalTokens)

  const chartLocaleTag =
    uiLocale === 'en'
      ? 'en-US'
      : uiLocale === 'zh'
        ? 'zh-CN'
        : uiLocale === 'ja'
          ? 'ja-JP'
          : uiLocale === 'ko'
            ? 'ko-KR'
            : 'vi-VN'

  const chartPayload = buildApiUsageChartData(logsRaw || [], fromDate, toDate, chartLocaleTag)
  const modelLabels: Record<string, string> = {}
  for (const log of logsList) {
    if (!modelLabels[log.model]) modelLabels[log.model] = getApiUsageModelDisplayLabel(log.model)
  }

  const chartCopy = {
    sectionTitle: tr('Biểu đồ theo thời gian', 'Trend charts', '趋势图', '推移チャート', '추이 차트'),
    subtitle: tr(
      'Theo ngày trong khoảng đã chọn • Tối đa 8 model phổ biến nhất; còn lại gộp “Khác”.',
      'By day in the selected range • Up to 8 most-used models; others grouped as “Other”.',
      '按所选日期范围 • 最多 8 个最常用模型，其余归入“其他”。',
      '選択した期間の日別 • 上位8モデル、その他は「その他」。',
      '선택한 기간 일별 • 상위 8개 모델, 나머지는 “기타”.'
    ),
    requestsAndInputTitle: tr(
      'Lượt gọi & token input theo ngày',
      'Calls & input tokens per day',
      '每日调用次数与输入 token',
      '日別の呼び出し数と入力トークン',
      '일별 호출 수·입력 토큰'
    ),
    tokenStackTitle: tr(
      'Token input / output xếp chồng theo ngày',
      'Stacked input / output tokens per day',
      '每日输入/输出 token（堆叠）',
      '日別の入出力トークン（積み上げ）',
      '일별 입·출력 토큰(누적)'
    ),
    inputTokensByModelTitle: tr(
      'Token input theo model (theo ngày)',
      'Input tokens by model (daily)',
      '按模型的每日输入 token',
      'モデル別の入力トークン（日次）',
      '모델별 입력 토큰(일별)'
    ),
    requestsByModelTitle: tr(
      'Lượt gọi theo model (theo ngày)',
      'Calls by model (daily)',
      '按模型的每日调用次数',
      'モデル別の呼び出し回数（日次）',
      '모델별 호출 수(일별)'
    ),
    legendRequests: tr('Lượt gọi', 'Calls', '调用次数', '呼び出し', '호출'),
    legendInputTokens: tr('Token input (ngày)', 'Input tokens (day)', '输入 token', '入力トークン', '입력 토큰'),
    legendInputStack: tr('Token input', 'Input tokens', '输入 token', '入力トークン', '입력 토큰'),
    legendOutputStack: tr('Token output', 'Output tokens', '输出 token', '出力トークン', '출력 토큰'),
    legendOtherModels: tr('Khác (các model còn lại)', 'Other models', '其他模型', 'その他のモデル', '기타 모델'),
    noDataMessage: tr(
      'Chưa có bản ghi api_usage_log trong khoảng này — không vẽ biểu đồ.',
      'No api_usage_log rows in this range — charts are hidden.',
      '此期间没有 api_usage_log 记录，不显示图表。',
      'この期間に api_usage_log がありません。',
      '이 기간에 api_usage_log가 없습니다.'
    ),
    noteDataScope: tr(
      'Dữ liệu lấy từ bảng api_usage_log (lượt gọi đã ghi nhận). Không có mã lỗi HTTP (404/500) trong bảng này — nếu cần theo dõi lỗi API cần nguồn log riêng.',
      'Data comes from api_usage_log (recorded calls). This table does not include HTTP error codes (404/500) — use separate logging if you need API error breakdown.',
      '数据来自 api_usage_log（已记录的调用）。此表不含 HTTP 错误码（404/500）—若需错误分析请另建日志。',
      'データは api_usage_log（記録済み呼び出し）です。HTTPエラーコード(404/500)は含まれません。',
      '데이터는 api_usage_log(기록된 호출)입니다. HTTP 오류 코드(404/500)는 없습니다.'
    ),
  }

  const rangeLabel = fromDate === toDate
    ? new Date(fromDate).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : `${new Date(fromDate).toLocaleDateString('vi-VN')} – ${new Date(toDate).toLocaleDateString('vi-VN')}`

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{tr('Thống kê sử dụng API Google (Gemini)', 'Google API usage statistics (Gemini)', 'Google API 使用统计（Gemini）', 'Google API利用統計（Gemini）', 'Google API 사용 통계 (Gemini)')}</h2>
        <p className="text-muted-foreground mt-1">
          {tr(
            'Toàn bộ bản ghi api_usage_log trong khoảng ngày • Tỷ giá 1 USD = 25.000₫',
            'All api_usage_log rows in the date range • Exchange rate: 1 USD = 25,000₫',
            '日期范围内全部 api_usage_log 记录 • 汇率：1 USD = 25,000₫',
            '期間内の api_usage_log 全件 • 為替: 1 USD = 25,000₫',
            '기간 내 api_usage_log 전체 • 환율: 1 USD = 25,000₫'
          )}
        </p>
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
          <Link href="/admin/api-stats/breakdown" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {tr(
              'Báo cáo phân cấp: nhóm → tính năng → model',
              'Hierarchical report: group → feature → model',
              '分层报表：分组 → 功能 → 模型',
              '階層レポート：グループ→機能→モデル',
              '계층 보고서: 그룹→기능→모델'
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
            <CardTitle className="text-sm font-medium">
              {tr('Token input', 'Input tokens', '输入 token', '入力トークン', '입력 토큰')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNum(totals.promptTokens)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {tr('Token output', 'Output tokens', '输出 token', '出力トークン', '출력 토큰')}
            </CardTitle>
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

      <ApiUsageCharts payload={chartPayload} modelLabels={modelLabels} copy={chartCopy} hasAnyLog={logsList.length > 0} />

      <Card>
        <CardHeader>
          <CardTitle>{tr('Token theo từng shop (Messaging)', 'Tokens by shop (Messaging)', '按店铺统计 Token（Messaging）', 'ショップ別トークン（Messaging）', '샵별 토큰 (Messaging)')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {tr(
              'Nguồn: bảng messaging_partner_ai_token_usage, gom theo shop trong khoảng ngày đã chọn.',
              'Source: messaging_partner_ai_token_usage, grouped by shop for the selected date range.',
              '来源：messaging_partner_ai_token_usage，按所选日期范围聚合到店铺。',
              'ソース: messaging_partner_ai_token_usage。選択期間でショップ集計。',
              '소스: messaging_partner_ai_token_usage. 선택 기간 기준 샵별 집계.'
            )}
          </p>
        </CardHeader>
        <CardContent>
          {byShopToken.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('Shop', 'Shop', '店铺', 'ショップ', '샵')}</TableHead>
                  <TableHead>{tr('Chủ shop', 'Owner', '店主', 'オーナー', '소유자')}</TableHead>
                  <TableHead className="text-right">{tr('Lượt gọi', 'Calls', '调用次数', '呼び出し回数', '호출 수')}</TableHead>
                  <TableHead className="text-right">{tr('Input', 'Input', '输入', '入力', '입력')}</TableHead>
                  <TableHead className="text-right">{tr('Output', 'Output', '输出', '出力', '출력')}</TableHead>
                  <TableHead className="text-right">{tr('Tổng token', 'Total tokens', '总 token', '合計トークン', '총 토큰')}</TableHead>
                  <TableHead className="text-right">{tr('Số model', 'Models', '模型数', 'モデル数', '모델 수')}</TableHead>
                  <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byShopToken.map((shop) => (
                  <TableRow key={shop.partnerId}>
                    <TableCell>
                      <span className="font-medium">{shop.partnerName || shop.partnerSlug || shop.partnerId}</span>
                      <br />
                      <span className="text-xs text-muted-foreground">{shop.partnerId}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{shop.ownerEmail || 'N/A'}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatNum(shop.calls)}</TableCell>
                    <TableCell className="text-right">{formatNum(shop.promptTokens)}</TableCell>
                    <TableCell className="text-right">{formatNum(shop.outputTokens)}</TableCell>
                    <TableCell className="text-right font-medium">{formatNum(shop.totalTokens)}</TableCell>
                    <TableCell className="text-right">{formatNum(shop.modelCount)}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-amber-700">{formatVnd(shop.costVnd)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              {tr(
                'Khoảng này chưa có token usage theo shop.',
                'No shop token usage in this range.',
                '此区间暂无店铺 token 使用记录。',
                'この期間にショップのトークン利用はありません。',
                '이 기간에는 샵 토큰 사용이 없습니다.'
              )}
            </p>
          )}
        </CardContent>
      </Card>

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
                  <TableHead>{tr('Model', 'Model', '模型', 'モデル', '모델')}</TableHead>
                  <TableHead className="text-right">{tr('Lượt gọi', 'Calls', '调用次数', '呼び出し回数', '호출 수')}</TableHead>
                  <TableHead className="text-right">2K</TableHead>
                  <TableHead className="text-right">4K</TableHead>
                  <TableHead className="text-right">{tr('Input', 'Input', '输入', '入力', '입력')}</TableHead>
                  <TableHead className="text-right">{tr('Output', 'Output', '输出', '出力', '출력')}</TableHead>
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
                  <TableHead className="text-right">{tr('Input', 'Input', '输入', '入力', '입력')}</TableHead>
                  <TableHead className="text-right">{tr('Output', 'Output', '输出', '出力', '출력')}</TableHead>
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
                <TableHead className="text-right">{tr('Input', 'Input', '输入', '入力', '입력')}</TableHead>
                <TableHead className="text-right">{tr('Output', 'Output', '输出', '出力', '출력')}</TableHead>
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
