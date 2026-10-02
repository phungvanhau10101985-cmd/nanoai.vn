import Link from 'next/link'
import { Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ApiStatsDateFilter } from './api-stats-date-filter'
import { LogsTableWithDetail } from './logs-table-with-detail'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { isEnglishCoachApiUsageFeature } from '@/lib/english-coach-api-usage'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { calcCostVnd, calcCostVndSplit, getPartnerAiTokenCostUsdToVnd, isListedApiCostModel } from './api-cost'
import { formatIctYmdVi, ictDayEndIso, ictDayStartIso, ictShiftDays, ictYmd } from './ict-date'
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

function formatShare(part: number, whole: number): string {
  if (!(whole > 0)) return '—'
  const pct = (part / whole) * 100
  if (pct > 0 && pct < 0.1) return '<0,1%'
  return `${pct.toLocaleString('vi-VN', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
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

  const fromParam = params.from?.trim()
  const toParam = params.to?.trim()
  const fromDate = fromParam || ictShiftDays(-30)
  const toDate = toParam || ictYmd()

  const fromIso = ictDayStartIso(fromDate)
  const toIso = ictDayEndIso(toDate)
  const usdToVnd = getPartnerAiTokenCostUsdToVnd()

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

  type AggBucket = {
    calls: number
    promptTokens: number
    outputTokens: number
    totalTokens: number
    costVnd: number
    inputCostVnd: number
    outputCostVnd: number
    calls1K: number
    calls2K: number
    calls4K: number
    callsNoImage: number
  }
  const newBucket = (): AggBucket => ({
    calls: 0,
    promptTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costVnd: 0,
    inputCostVnd: 0,
    outputCostVnd: 0,
    calls1K: 0,
    calls2K: 0,
    calls4K: 0,
    callsNoImage: 0,
  })

  const byModel = logsList.reduce(
    (acc, log) => {
      const key = log.model
      if (!acc[key]) acc[key] = newBucket()
      acc[key].calls += 1
      acc[key].promptTokens += log.prompt_token_count || 0
      acc[key].outputTokens += log.candidates_token_count || 0
      acc[key].totalTokens += log.total_token_count || 0
      const imgSize = (log as { image_size?: string | null }).image_size
      const split = calcCostVndSplit(log.prompt_token_count || 0, log.candidates_token_count || 0, log.model, imgSize, {
        usdToVnd,
      })
      acc[key].costVnd += split.totalVnd
      acc[key].inputCostVnd += split.inputVnd
      acc[key].outputCostVnd += split.outputVnd
      if (imgSize === '1K') acc[key].calls1K += 1
      else if (imgSize === '2K') acc[key].calls2K += 1
      else if (imgSize === '4K') acc[key].calls4K += 1
      else acc[key].callsNoImage += 1
      return acc
    },
    {} as Record<string, AggBucket>
  )

  const byFeature = logsList.reduce(
    (acc, log) => {
      const key = log.feature
      if (!acc[key]) acc[key] = newBucket()
      acc[key].calls += 1
      acc[key].promptTokens += log.prompt_token_count || 0
      acc[key].outputTokens += log.candidates_token_count || 0
      acc[key].totalTokens += log.total_token_count || 0
      const imgSize = (log as { image_size?: string | null }).image_size
      const split = calcCostVndSplit(log.prompt_token_count || 0, log.candidates_token_count || 0, log.model, imgSize, {
        usdToVnd,
      })
      acc[key].costVnd += split.totalVnd
      acc[key].inputCostVnd += split.inputVnd
      acc[key].outputCostVnd += split.outputVnd
      if (imgSize === '1K') acc[key].calls1K += 1
      else if (imgSize === '2K') acc[key].calls2K += 1
      else if (imgSize === '4K') acc[key].calls4K += 1
      else acc[key].callsNoImage += 1
      return acc
    },
    {} as Record<string, AggBucket>
  )

  const byImageSize = logsList.reduce(
    (acc, log) => {
      const imgSize = (log as { image_size?: string | null }).image_size
      const key = imgSize === '1K' ? '1K' : imgSize === '2K' ? '2K' : imgSize === '4K' ? '4K' : 'no-image'
      if (!acc[key]) {
        acc[key] = { calls: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0, costVnd: 0, inputCostVnd: 0, outputCostVnd: 0 }
      }
      acc[key].calls += 1
      acc[key].promptTokens += log.prompt_token_count || 0
      acc[key].outputTokens += log.candidates_token_count || 0
      acc[key].totalTokens += log.total_token_count || 0
      const split = calcCostVndSplit(
        log.prompt_token_count || 0,
        log.candidates_token_count || 0,
        log.model,
        (log as { image_size?: string | null }).image_size,
        { usdToVnd }
      )
      acc[key].costVnd += split.totalVnd
      acc[key].inputCostVnd += split.inputVnd
      acc[key].outputCostVnd += split.outputVnd
      return acc
    },
    {} as Record<string, { calls: number; promptTokens: number; outputTokens: number; totalTokens: number; costVnd: number; inputCostVnd: number; outputCostVnd: number }>
  )

  const totals = {
    calls: logsList.length,
    promptTokens: logsList.reduce((s, l) => s + (l.prompt_token_count || 0), 0),
    outputTokens: logsList.reduce((s, l) => s + (l.candidates_token_count || 0), 0),
    totalTokens: logsList.reduce((s, l) => s + (l.total_token_count || 0), 0),
    inputCostVnd: 0,
    outputCostVnd: 0,
    totalCostVnd: 0,
  }
  for (const log of logsList) {
    const split = calcCostVndSplit(
      log.prompt_token_count || 0,
      log.candidates_token_count || 0,
      log.model,
      (log as { image_size?: string | null }).image_size,
      { usdToVnd }
    )
    totals.inputCostVnd += split.inputVnd
    totals.outputCostVnd += split.outputVnd
    totals.totalCostVnd += split.totalVnd
  }

  const apiCostVndInRange = totals.totalCostVnd
  const apiCostUsdInRange = apiCostVndInRange / usdToVnd

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
          inputCostVnd: 0,
          outputCostVnd: 0,
          models: [] as Array<{
            usageKind: string | null
            model: string
            calls: number
            promptTokens: number
            outputTokens: number
            totalTokens: number
            costVnd: number
            inputCostVnd: number
            outputCostVnd: number
            listedPrice: boolean
          }>,
        }
      }
      const current = acc[key]
      const split = calcCostVndSplit(row.sum_prompt_tokens, row.sum_completion_tokens, row.model, null, {
        usdToVnd,
        pricingMode: 'aggregate_short',
      })
      current.calls += row.call_count
      current.promptTokens += row.sum_prompt_tokens
      current.outputTokens += row.sum_completion_tokens
      current.totalTokens += row.sum_total_tokens
      current.costVnd += split.totalVnd
      current.inputCostVnd += split.inputVnd
      current.outputCostVnd += split.outputVnd
      current.models.push({
        usageKind: row.usage_kind,
        model: row.model,
        calls: row.call_count,
        promptTokens: row.sum_prompt_tokens,
        outputTokens: row.sum_completion_tokens,
        totalTokens: row.sum_total_tokens,
        costVnd: split.totalVnd,
        inputCostVnd: split.inputVnd,
        outputCostVnd: split.outputVnd,
        listedPrice: isListedApiCostModel(row.model),
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
        inputCostVnd: number
        outputCostVnd: number
        models: Array<{
          usageKind: string | null
          model: string
          calls: number
          promptTokens: number
          outputTokens: number
          totalTokens: number
          costVnd: number
          inputCostVnd: number
          outputCostVnd: number
          listedPrice: boolean
        }>
      }
    >
  )

  const byShopToken = Object.values(byShopTokenMap)
    .map((x) => ({
      ...x,
      modelCount: x.models.length,
      models: [...x.models].sort((a, b) => b.costVnd - a.costVnd),
    }))
    .sort((a, b) => b.costVnd - a.costVnd)
  const shopCostVndTotal = byShopToken.reduce((sum, shop) => sum + shop.costVnd, 0)
  /** Ảnh chất liệu / thực tế trong chat chỉ ghi sổ shop, không ghi api_usage_log. */
  const shopImageCostOutsidePlatformLog = byShopToken.reduce(
    (sum, shop) =>
      sum +
      shop.models.reduce(
        (inner, modelRow) =>
          modelRow.usageKind === 'image_material_detail' || modelRow.usageKind === 'image_real_use'
            ? inner + modelRow.costVnd
            : inner,
        0
      ),
    0
  )
  const profitInRange = revenueInRange - apiCostVndInRange - shopImageCostOutsidePlatformLog

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

  const chartPayload = buildApiUsageChartData(logsRaw || [], fromDate, toDate, chartLocaleTag, 8, usdToVnd)
  const modelLabels: Record<string, string> = {}
  for (const log of logsList) {
    if (!modelLabels[log.model]) modelLabels[log.model] = getApiUsageModelDisplayLabel(log.model)
  }

  const chartCopy = {
    sectionTitle: tr('Biểu đồ theo thời gian', 'Trend charts', '趋势图', '推移チャート', '추이 차트'),
    subtitle: tr(
      'Theo ngày giờ Việt Nam (ICT) trong khoảng đã chọn • Tối đa 8 model đắt nhất; còn lại gộp “Khác”.',
      'By Vietnam-time day in the selected range • Up to 8 costliest models; others grouped as “Other”.',
      '按越南时间的所选日期 • 费用最高的 8 个模型，其余归入“其他”。',
      'ベトナム時間の日別 • 費用上位8モデル、その他は「その他」。',
      '베트남 시간 기준 일별 • 비용 상위 8개 모델, 나머지는 “기타”.'
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
    costStackTitle: tr(
      'Chi phí ₫ input / output xếp chồng theo ngày',
      'Stacked input / output cost (₫) per day',
      '每日输入/输出费用（₫，堆叠）',
      '日別の入出力コスト（₫、積み上げ）',
      '일별 입·출력 비용(₫, 누적)'
    ),
    costByModelTitle: tr(
      'Chi phí ₫ theo model (theo ngày)',
      'Cost (₫) by model (daily)',
      '按模型的每日费用 (₫)',
      'モデル別のコスト（₫、日次）',
      '모델별 비용(₫, 일별)'
    ),
    legendRequests: tr('Lượt gọi', 'Calls', '调用次数', '呼び出し', '호출'),
    legendInputTokens: tr('Token input (ngày)', 'Input tokens (day)', '输入 token', '入力トークン', '입력 토큰'),
    legendInputStack: tr('Token input', 'Input tokens', '输入 token', '入力トークン', '입력 토큰'),
    legendOutputStack: tr('Token output', 'Output tokens', '输出 token', '出力トークン', '출력 토큰'),
    legendInputCostStack: tr('Chi phí input (₫)', 'Input cost (₫)', '输入费用 (₫)', '入力コスト (₫)', '입력 비용(₫)'),
    legendOutputCostStack: tr('Chi phí output (₫)', 'Output cost (₫)', '输出费用 (₫)', '出力コスト (₫)', '출력 비용(₫)'),
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

  const rangeLabel =
    fromDate === toDate
      ? formatIctYmdVi(fromDate)
      : `${formatIctYmdVi(fromDate)} – ${formatIctYmdVi(toDate)}`

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{tr('Thống kê chi phí API nền tảng', 'Platform API cost', '平台 API 费用', 'プラットフォーム API 費用', '플랫폼 API 비용')}</h2>
        <p className="text-muted-foreground mt-1">
          {tr(
            'Sổ api_usage_log (Gemini, DeepSeek, OpenAI…) trong khoảng ngày giờ Việt Nam • Tỷ giá 1 USD = {rate}₫',
            'api_usage_log (Gemini, DeepSeek, OpenAI…) in Vietnam-time days • Exchange rate: 1 USD = {rate}₫',
            'api_usage_log（Gemini、DeepSeek、OpenAI…）按越南时间 • 汇率：1 USD = {rate}₫',
            'api_usage_log（Gemini / DeepSeek / OpenAI…）ベトナム時間 • 為替: 1 USD = {rate}₫',
            'api_usage_log(Gemini, DeepSeek, OpenAI…) 베트남 시간 • 환율: 1 USD = {rate}₫'
          ).replace('{rate}', usdToVnd.toLocaleString('vi-VN'))}
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
          <Link href="/admin/credit-spend-stats" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {tr(
              'Nhật ký trừ credit theo tính năng',
              'Credit spend ledger by feature',
              '按功能的积分消耗流水',
              '機能別クレジット消費ログ',
              '기능별 크레딧 사용 기록'
            )}
          </Link>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {tr(
            'Đơn giá lấy từ bảng trong mã (Gemini / DeepSeek / OpenAI, USD/1M). Model chưa có dòng dùng giá gemini-3-flash-preview. Veo / Imagen / Lyria ghi lượt gọi, không tính token.',
            'Rates come from the in-code table (Gemini / DeepSeek / OpenAI, USD per 1M). Unknown models use gemini-3-flash-preview. Veo / Imagen / Lyria log calls only.',
            '单价来自代码内价格表（Gemini / DeepSeek / OpenAI，每百万 token 美元）。未登记模型按 gemini-3-flash-preview。Veo / Imagen / Lyria 只记调用。',
            '単価はコード内の表（Gemini / DeepSeek / OpenAI、100万トークンあたり USD）。未登録は gemini-3-flash-preview。Veo / Imagen / Lyria は呼び出しのみ。',
            '단가는 코드 표(Gemini / DeepSeek / OpenAI, 100만 토큰당 USD). 미등록은 gemini-3-flash-preview. Veo / Imagen / Lyria는 호출만 기록합니다.'
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
              {shopImageCostOutsidePlatformLog > 0 ? (
                <p className="text-xs text-amber-800 mt-1">
                  {tr(
                    'Cộng thêm ảnh chat shop chưa vào sổ này',
                    'Plus shop chat images not in this ledger',
                    '另加未入此账的店铺聊天出图',
                    'この台帳にないショップ画像を加算',
                    '이 장부에 없는 샵 채팅 이미지 추가'
                  )}
                  : {formatVnd(shopImageCostOutsidePlatformLog)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tr('Lợi nhuận', 'Profit', '利润', '利益', '이익')}</p>
              <p className={`text-2xl font-bold ${profitInRange >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatVnd(profitInRange)}
              </p>
              <p className="text-xs text-muted-foreground">{tr('Thu nạp credit − chi api_usage_log − ảnh chất liệu/thực tế của shop (chỉ có ở sổ shop). Chat DeepSeek và ảnh landing đã nằm trong sổ API nên không trừ lần hai.', 'Top-up revenue − api_usage_log − shop material/lifestyle images (shop ledger only). DeepSeek chat and landing images are already in the API ledger.', '充值收入 − api_usage_log − 店铺面料/实拍图（仅店铺账）。DeepSeek 对话和落地页图已在 API 账中。', 'チャージ収入 − api_usage_log − ショップの素材/実使用画像（ショップ台帳のみ）。DeepSeek とランディング画像は API 台帳に既出。', '충전 매출 − api_usage_log − 샵 소재/실사용 이미지(샵 장부만). DeepSeek 대화와 랜딩 이미지는 API 장부에 이미 있습니다.')}</p>
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
            <p className="text-xs text-muted-foreground mt-1">
              ~{formatVnd(totals.calls ? Math.round(totals.totalCostVnd / totals.calls) : 0)}/{tr('lượt', 'call', '次', '回', '회')}
            </p>
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
            <p className="text-xs text-amber-700 mt-1 font-medium">{formatVnd(totals.inputCostVnd)}</p>
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
            <p className="text-xs text-amber-700 mt-1 font-medium">{formatVnd(totals.outputCostVnd)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{tr('Tổng tokens', 'Total tokens', '总 tokens', '合計 tokens', '총 tokens')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNum(totals.totalTokens)}</p>
            <p className="text-xs text-amber-700 mt-1 font-medium">{formatVnd(totals.totalCostVnd)}</p>
          </CardContent>
        </Card>
      </div>

      <ApiUsageCharts payload={chartPayload} modelLabels={modelLabels} copy={chartCopy} hasAnyLog={logsList.length > 0} />

      <Card>
        <CardHeader>
          <CardTitle>{tr('Token theo từng shop (Messaging)', 'Tokens by shop (Messaging)', '按店铺统计 Token（Messaging）', 'ショップ別トークン（Messaging）', '샵별 토큰 (Messaging)')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {tr(
              'Sổ messaging_partner_ai_token_usage, xếp theo chi phí. Mỗi dòng model ghi nhánh (hội thoại, suy chất liệu, ảnh…). Chat và ảnh landing đã nằm trong sổ API phía trên. Chỉ ảnh chất liệu và ảnh thực tế được cộng vào lợi nhuận.',
              'Ledger messaging_partner_ai_token_usage, sorted by cost. Each model row shows its branch (chat, material, images…). Chat and landing images are already in the API ledger above. Only material and lifestyle images are added into profit.',
              '来源 messaging_partner_ai_token_usage，按费用排序。每个模型行标出用途。对话和落地页图已在上方 API 账。只有面料图和实拍图计入利润。',
              '台帳 messaging_partner_ai_token_usage。費用順。各モデル行に用途。チャットとランディング画像は上の API 台帳に既出。素材画像と実使用画像だけ利益に含めます。',
              '원장 messaging_partner_ai_token_usage, 비용순. 각 모델 행에 용도. 대화와 랜딩 이미지는 위 API 장부에 있습니다. 소재·실사용 이미지만 이익에 넣습니다.'
            )}
          </p>
          {shopCostVndTotal > 0 ? (
            <p className="text-sm font-semibold tabular-nums text-amber-800">
              {tr('Tổng chi shop SaaS', 'Total SaaS shop cost', '店铺费用合计', 'ショップ費用合計', '샵 비용 합계')}: {formatVnd(shopCostVndTotal)}
              {' · '}
              {formatNum(byShopToken.reduce((s, shop) => s + shop.calls, 0))}{' '}
              {tr('lượt', 'calls', '次', '回', '회')}
            </p>
          ) : null}
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
                  <TableHead className="text-right">{tr('Số dòng', 'Rows', '行数', '行数', '행 수')}</TableHead>
                  <TableHead className="text-right">{tr('Tỷ lệ', 'Share', '占比', '割合', '비중')}</TableHead>
                  <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byShopToken.map((shop) => (
                  <Fragment key={shop.partnerId}>
                    <TableRow key={`${shop.partnerId}-total`} className="bg-muted/30">
                      <TableCell>
                        <span className="font-medium">{shop.partnerName || shop.partnerSlug || shop.partnerId}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{shop.partnerSlug || shop.partnerId}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{shop.ownerEmail || '—'}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatNum(shop.calls)}</TableCell>
                      <TableCell className="text-right">
                        <span>{formatNum(shop.promptTokens)}</span>
                        <br />
                        <span className="text-xs text-amber-700">{formatVnd(shop.inputCostVnd)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span>{formatNum(shop.outputTokens)}</span>
                        <br />
                        <span className="text-xs text-amber-700">{formatVnd(shop.outputCostVnd)}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatNum(shop.totalTokens)}</TableCell>
                      <TableCell className="text-right">{formatNum(shop.modelCount)}</TableCell>
                      <TableCell className="text-right">{formatShare(shop.costVnd, shopCostVndTotal)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-amber-700">{formatVnd(shop.costVnd)}</span>
                      </TableCell>
                    </TableRow>
                    {shop.models.map((modelRow) => (
                      <TableRow key={`${shop.partnerId}:${modelRow.usageKind ?? 'inbox'}:${modelRow.model}`}>
                        <TableCell className="pl-6">
                          <span className="text-[11px] text-muted-foreground">
                            {modelRow.usageKind == null
                              ? tr('Hội thoại', 'Chat', '对话', 'チャット', '대화')
                              : modelRow.usageKind === 'material_infer'
                                ? tr('Suy chất liệu', 'Material infer', '面料推断', '素材推定', '소재 추론')
                                : modelRow.usageKind === 'image_material_detail'
                                  ? tr('Ảnh chất liệu', 'Material image', '面料图', '素材画像', '소재 이미지')
                                  : modelRow.usageKind === 'image_real_use'
                                    ? tr('Ảnh thực tế', 'Lifestyle image', '实拍图', '実使用画像', '실사용 이미지')
                                    : modelRow.usageKind === 'image_landing_material'
                                      ? tr('Ảnh landing', 'Landing image', '落地页图', 'ランディング画像', '랜딩 이미지')
                                      : modelRow.usageKind}
                          </span>
                          <br />
                          <span className="font-mono text-xs">{modelRow.model}</span>
                          {modelRow.usageKind === 'image_material_detail' || modelRow.usageKind === 'image_real_use' ? (
                            <span className="ml-2 text-[10px] text-amber-800">
                              {tr('ngoài sổ API', 'not in API ledger', '不在 API 账', 'API台帳外', 'API 장부 밖')}
                            </span>
                          ) : null}
                          {modelRow.listedPrice ? null : (
                            <span className="ml-2 text-[10px] text-amber-700">
                              {tr('giá tạm', 'fallback price', '临时价格', '暫定価格', '임시 가격')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right text-muted-foreground">{formatNum(modelRow.calls)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          <span>{formatNum(modelRow.promptTokens)}</span>
                          <br />
                          <span className="text-xs">{formatVnd(modelRow.inputCostVnd)}</span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          <span>{formatNum(modelRow.outputTokens)}</span>
                          <br />
                          <span className="text-xs">{formatVnd(modelRow.outputCostVnd)}</span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatNum(modelRow.totalTokens)}</TableCell>
                        <TableCell />
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatShare(modelRow.costVnd, shop.costVnd)}
                        </TableCell>
                        <TableCell className="text-right text-amber-700">{formatVnd(modelRow.costVnd)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
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

      <div className="space-y-6">
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
                  <TableHead className="text-right">1K</TableHead>
                  <TableHead className="text-right">2K</TableHead>
                  <TableHead className="text-right">4K</TableHead>
                  <TableHead className="text-right">{tr('Input', 'Input', '输入', '入力', '입력')}</TableHead>
                  <TableHead className="text-right">{tr('Output', 'Output', '输出', '出力', '출력')}</TableHead>
                  <TableHead className="text-right">{tr('Tổng', 'Total', '总计', '合計', '합계')}</TableHead>
                  <TableHead className="text-right">{tr('Tỷ lệ', 'Share', '占比', '割合', '비중')}</TableHead>
                  <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(byModel)
                  .sort((a, b) => b[1].costVnd - a[1].costVnd)
                  .map(([model, stats]) => (
                    <TableRow key={model}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {model}
                        </Badge>
                        {isListedApiCostModel(model) ? null : (
                          <span className="ml-2 text-[10px] text-amber-700">
                            {tr('giá tạm', 'fallback price', '临时价格', '暫定価格', '임시 가격')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatNum(stats.calls)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.calls1K)}</TableCell>
                      <TableCell className="text-right text-sky-600">{formatNum(stats.calls2K)}</TableCell>
                      <TableCell className="text-right text-amber-600">{formatNum(stats.calls4K)}</TableCell>
                      <TableCell className="text-right">
                        <span>{formatNum(stats.promptTokens)}</span>
                        <br />
                        <span className="text-xs text-amber-700">{formatVnd(stats.inputCostVnd)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span>{formatNum(stats.outputTokens)}</span>
                        <br />
                        <span className="text-xs text-amber-700">{formatVnd(stats.outputCostVnd)}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatNum(stats.totalTokens)}</TableCell>
                      <TableCell className="text-right text-xs">{formatShare(stats.costVnd, totals.totalCostVnd)}</TableCell>
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
                  <TableHead className="text-right">1K</TableHead>
                  <TableHead className="text-right">2K</TableHead>
                  <TableHead className="text-right">4K</TableHead>
                  <TableHead className="text-right">{tr('Input', 'Input', '输入', '入力', '입력')}</TableHead>
                  <TableHead className="text-right">{tr('Output', 'Output', '输出', '出力', '출력')}</TableHead>
                  <TableHead className="text-right">{tr('Tổng', 'Total', '总计', '合計', '합계')}</TableHead>
                  <TableHead className="text-right">{tr('Tỷ lệ', 'Share', '占比', '割合', '비중')}</TableHead>
                  <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(byFeature)
                  .sort((a, b) => b[1].costVnd - a[1].costVnd)
                  .map(([feature, stats]) => (
                    <TableRow key={feature}>
                      <TableCell>
                        <span className="font-medium">{featureLabelsMerged[feature] || feature}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{feature}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatNum(stats.calls)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.calls1K)}</TableCell>
                      <TableCell className="text-right text-sky-600">{formatNum(stats.calls2K)}</TableCell>
                      <TableCell className="text-right text-amber-600">{formatNum(stats.calls4K)}</TableCell>
                      <TableCell className="text-right">
                        <span>{formatNum(stats.promptTokens)}</span>
                        <br />
                        <span className="text-xs text-amber-700">{formatVnd(stats.inputCostVnd)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span>{formatNum(stats.outputTokens)}</span>
                        <br />
                        <span className="text-xs text-amber-700">{formatVnd(stats.outputCostVnd)}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatNum(stats.totalTokens)}</TableCell>
                      <TableCell className="text-right text-xs">{formatShare(stats.costVnd, totals.totalCostVnd)}</TableCell>
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
          <p className="text-sm text-muted-foreground">{tr('Số lượt gọi trả ảnh 1K, 2K, 4K hoặc không trả ảnh (chỉ text)', 'Calls returning 1K, 2K, 4K images or no image (text only)', '返回 1K、2K、4K 图片或不返回图片（仅文本）', '1K/2K/4K画像または画像なし（テキストのみ）', '1K/2K/4K 이미지 또는 이미지 없음(텍스트만)')}</p>
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
              {(['1K', '2K', '4K', 'no-image'] as const).map((key) => {
                const label =
                  key === '1K'
                    ? '1K'
                    : key === '2K'
                      ? '2K'
                      : key === '4K'
                        ? '4K'
                        : tr('Không trả ảnh', 'No image', '无图片', '画像なし', '이미지 없음')
                const stats = byImageSize[key]
                if (!stats || stats.calls === 0) return null
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <Badge variant={key === 'no-image' ? 'secondary' : 'outline'} className={key === '1K' || key === '2K' ? 'text-sky-600 border-sky-300' : key === '4K' ? 'text-amber-600 border-amber-300' : ''}>
                        {label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNum(stats.calls)}</TableCell>
                    <TableCell className="text-right">
                      <span>{formatNum(stats.promptTokens)}</span>
                      <br />
                      <span className="text-xs text-amber-700">{formatVnd(stats.inputCostVnd)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span>{formatNum(stats.outputTokens)}</span>
                      <br />
                      <span className="text-xs text-amber-700">{formatVnd(stats.outputCostVnd)}</span>
                    </TableCell>
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
                  (log as { image_size?: string | null }).image_size,
                  { usdToVnd }
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
