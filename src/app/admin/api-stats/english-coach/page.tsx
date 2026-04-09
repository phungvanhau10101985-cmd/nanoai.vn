import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ApiStatsDateFilter } from '../api-stats-date-filter'
import { LogsTableWithDetail } from '../logs-table-with-detail'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { calcCostVnd, USD_TO_VND } from '../api-cost'
import { buildEnglishCoachFeatureLabelsForLogs } from '../english-coach-feature-labels'
import {
  aggregateEnglishCoachApiCostByLessonKind,
  aggregateLanguageCoachCredits,
} from '../language-coach-financials'
import { fetchAllApiUsageLogsInRange, sortApiUsageLogsNewestFirst } from '../fetch-api-usage-logs-range'
import { fetchLanguageCoachCreditEventsInRange } from '@/lib/db/admin-api-stats-pg'

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function AdminEnglishCoachApiStatsPage({
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

  const [logFetch, creditEvents] = await Promise.all([
    fetchAllApiUsageLogsInRange(fromIso, toIso, { featureLike: 'english-coach-%' }),
    fetchLanguageCoachCreditEventsInRange(fromIso, toIso),
  ])

  const { data: logsRaw, error } = logFetch

  if (error) {
    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight">
          {tr('Học ngoại ngữ AI — API', 'Language coach — API', '外语学习 AI — API', '語学コーチ — API', '외국어 코치 — API')}
        </h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{tr('Lỗi', 'Error', '错误', 'エラー', '오류')}: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const logsList = sortApiUsageLogsNewestFirst(logsRaw || [])
  const creditAgg = aggregateLanguageCoachCredits(creditEvents)
  const apiByKind = aggregateEnglishCoachApiCostByLessonKind(logsList)
  const coachFeatureLabels = buildEnglishCoachFeatureLabelsForLogs(logsList.map((l) => l.feature))

  type Agg = {
    calls: number
    promptTokens: number
    outputTokens: number
    totalTokens: number
    costVnd: number
    calls2K: number
    calls4K: number
    callsNoImage: number
  }

  const byModel = logsList.reduce((acc, log) => {
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
  }, {} as Record<string, Agg>)

  const byFeature = logsList.reduce((acc, log) => {
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
  }, {} as Record<string, Agg>)

  const byImageSize = logsList.reduce((acc, log) => {
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
  }, {} as Record<string, { calls: number; promptTokens: number; outputTokens: number; totalTokens: number; costVnd: number }>)

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

  const formatNum = (n: number) => n.toLocaleString('vi-VN')
  const formatVnd = (n: number) => `${n.toLocaleString('vi-VN')}₫`

  const rangeLabel =
    fromDate === toDate
      ? new Date(fromDate).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : `${new Date(fromDate).toLocaleDateString('vi-VN')} – ${new Date(toDate).toLocaleDateString('vi-VN')}`

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {tr(
            'Học ngoại ngữ AI — Chi phí API (Gemini)',
            'Language coach — API cost (Gemini)',
            '外语学习 AI — API 费用（Gemini）',
            '語学コーチ — APIコスト（Gemini）',
            '외국어 코치 — API 비용 (Gemini)'
          )}
        </h2>
        <p className="text-muted-foreground mt-1">
          {tr(
            'Chỉ các bản ghi feature bắt đầu bằng english-coach- • Toàn bộ trong khoảng ngày • 1 USD = 25.000₫',
            'Only rows where feature starts with english-coach- • Full date range • 1 USD = 25,000₫',
            '仅 feature 以 english-coach- 开头 • 日期范围内全部 • 1 USD = 25,000₫',
            'feature が english-coach- で始まる行 • 期間内の全件 • 1 USD = 25,000₫',
            'feature가 english-coach-로 시작 • 기간 내 전체 • 1 USD = 25,000₫'
          )}
        </p>
        <p className="text-sm mt-2">
          <Link href="/admin/api-stats" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {tr('← Thống kê API tổng hợp', '← Combined API statistics', '← 综合 API 统计', '← 統合API統計', '← 통합 API 통계')}
          </Link>
        </p>
        <p className="text-xs text-amber-800/90 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
          {tr(
            'Lưu ý: TTS OpenAI / Gemini TTS và DeepSeek fallback không ghi vào bảng này. Chỉ có lượt Gemini có usageMetadata mới xuất hiện sau khi deploy bản ghi log.',
            'Note: OpenAI / Gemini TTS and DeepSeek fallback are not logged here. Only Gemini calls with usageMetadata appear after the logging deploy.',
            '说明：OpenAI/Gemini TTS 与 DeepSeek 兜底不会记入此表。部署记录逻辑后，仅含 usageMetadata 的 Gemini 调用会出现。',
            '注: OpenAI/Gemini TTS と DeepSeek フォールバックはここに含まれません。ログ実装後、usageMetadata 付き Gemini のみ表示されます。',
            '참고: OpenAI/Gemini TTS·DeepSeek 폴백은 여기에 없습니다. 로깅 배포 후 usageMetadata가 있는 Gemini만 표시됩니다.'
          )}
        </p>
      </div>

      <ApiStatsDateFilter
        key={`${fromDate}-${toDate}`}
        defaultFrom={fromDate}
        defaultTo={toDate}
        basePath="/admin/api-stats/english-coach"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-emerald-200 bg-emerald-50/25">
          <CardHeader>
            <CardTitle>
              {tr(
                'Thu credit — buổi live',
                'Credits collected — live lessons',
                '已收积分 — 直播课',
                'クレジット収入 — ライブ',
                '크레딧 수입 — 라이브'
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-emerald-800">{formatVnd(creditAgg.liveCreditsVnd)}</p>
            <p className="text-sm text-muted-foreground">
              {creditAgg.liveCredits.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
              credits • 1 credit = {formatNum(CREDIT_UNIT_PRICE_VND)}₫
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>
                {tr('Mở gói 10 lượt:', 'Live pack (10 turns):', '开通10轮套餐:', '10ターン枠:', '10턴 패키지:')}{' '}
                {formatNum(creditAgg.liveStartCount)}
              </li>
              <li>
                {tr('Mở thêm lượt:', 'Extra turn unlocks:', '加购轮次:', '追加枠:', '추가 해제:')}{' '}
                {formatNum(creditAgg.liveUnlockCount)}
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/25">
          <CardHeader>
            <CardTitle>
              {tr(
                'Thu credit — bài có sẵn',
                'Credits collected — preset lessons',
                '已收积分 — 现成课',
                'クレジット収入 — プリセット',
                '크레딧 수입 — 프리셋'
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-violet-900">{formatVnd(creditAgg.presetCreditsVnd)}</p>
            <p className="text-sm text-muted-foreground">
              {creditAgg.presetCredits.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
              credits • 1 credit = {formatNum(CREDIT_UNIT_PRICE_VND)}₫
            </p>
            <p className="text-xs text-muted-foreground">
              {tr('Số lần mở bài:', 'Preset starts:', '开课次数:', 'プリセット開始回数:', '프리셋 시작 횟수:')}{' '}
              {formatNum(creditAgg.presetStartCount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-sky-300 bg-sky-50/40 ring-1 ring-sky-200/60">
          <CardHeader>
            <CardTitle className="text-base">
              {tr(
                'Chi phí API Gemini — buổi live',
                'Gemini API cost — live only',
                'Gemini API 费用 — 仅直播',
                'Gemini API — ライブのみ',
                'Gemini API — 라이브만'
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700">{formatVnd(apiByKind.liveVnd)}</p>
            <p className="text-xs text-muted-foreground mt-1">~{apiByKind.liveUsd.toFixed(4)} USD</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50/30">
          <CardHeader>
            <CardTitle className="text-base">
              {tr(
                'Chi phí API — bài có sẵn',
                'API cost — preset',
                'API 费用 — 现成课',
                'API — プリセット',
                'API — 프리셋'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-700">{formatVnd(apiByKind.presetVnd)}</p>
            <p className="text-xs text-muted-foreground mt-1">~{apiByKind.presetUsd.toFixed(4)} USD</p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-amber-50/20">
          <CardHeader>
            <CardTitle className="text-base">
              {tr(
                'API — chưa gắn live/có sẵn (cũ)',
                'API — unlabeled (legacy)',
                'API — 未标注（旧）',
                'API — 未分類（旧ログ）',
                'API — 미분류(구로그)'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-800">{formatVnd(apiByKind.legacyVnd)}</p>
            <p className="text-xs text-muted-foreground mt-1">~{apiByKind.legacyUsd.toFixed(4)} USD</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-sky-200 bg-sky-50/30">
        <CardHeader>
          <CardTitle>{tr('Tổng chi phí API (Gemini, toàn bộ english-coach)', 'Total API cost (all english-coach)', 'API 总费用（全部 english-coach）', 'API合計（english-coach 全体）', 'API 총액 (english-coach 전체)')}</CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-amber-700">{formatVnd(apiCostVndInRange)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            ~{apiCostUsdInRange.toFixed(4)} USD • {logsList.length}{' '}
            {tr('lượt gọi Gemini (đã log)', 'logged Gemini calls', '条已记录 Gemini 调用', '件の記録済みGemini呼び出し', '기록된 Gemini 호출')}
          </p>
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
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">{tr('Lượt gọi', 'Calls', '调用次数', '呼び出し回数', '호출 수')}</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
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
                      <TableCell className="text-right">{formatNum(stats.promptTokens)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.outputTokens)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-amber-700">{formatVnd(stats.costVnd)}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          ~{formatVnd(stats.calls ? Math.round(stats.costVnd / stats.calls) : 0)}/{tr('lượt', 'call', '次', '回', '회')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr('Theo bước xử lý', 'By pipeline step', '按处理步骤', '処理ステップ別', '처리 단계별')}</CardTitle>
            <p className="text-sm text-muted-foreground">{tr('Khóa feature trong mã nguồn', 'Feature keys in source code', '源代码中的 feature 键', 'ソースコードの feature キー', '소스의 feature 키')}</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('Bước', 'Step', '步骤', 'ステップ', '단계')}</TableHead>
                  <TableHead className="text-right">{tr('Lượt gọi', 'Calls', '调用次数', '呼び出し回数', '호출 수')}</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(byFeature)
                  .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
                  .map(([feature, stats]) => (
                    <TableRow key={feature}>
                      <TableCell>
                        <span className="font-medium">{coachFeatureLabels[feature] || feature}</span>
                        <br />
                        <span className="text-xs text-muted-foreground font-mono">{feature}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatNum(stats.calls)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.promptTokens)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.outputTokens)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-amber-700">{formatVnd(stats.costVnd)}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          ~{formatVnd(stats.calls ? Math.round(stats.costVnd / stats.calls) : 0)}/{tr('lượt', 'call', '次', '回', '회')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {(['2K', '4K'] as const).some((k) => byImageSize[k]?.calls) ? (
        <Card>
          <CardHeader>
            <CardTitle>{tr('Theo độ phân giải ảnh (nếu có)', 'By image resolution (if any)', '按图像分辨率（如有）', '画像解像度（該当時）', '이미지 해상도(해당 시)')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('Loại', 'Type', '类型', '種類', '유형')}</TableHead>
                  <TableHead className="text-right">{tr('Lượt gọi', 'Calls', '调用次数', '呼び出し回数', '호출 수')}</TableHead>
                  <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(['2K', '4K'] as const).map((key) => {
                  const stats = byImageSize[key]
                  if (!stats?.calls) return null
                  return (
                    <TableRow key={key}>
                      <TableCell>{key}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.calls)}</TableCell>
                      <TableCell className="text-right">{formatVnd(stats.costVnd)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{tr('Chi tiết gần đây', 'Recent details', '最近明细', '最近の詳細', '최근 상세')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {tr('100 bản ghi mới nhất trong phạm vi english-coach-', 'Latest 100 rows with english-coach- prefix', 'english-coach- 前缀内最新100条', 'english-coach- 接頭辞の最新100件', 'english-coach- 접두사 최신 100건')}
          </p>
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
              featureLabels={coachFeatureLabels}
            />
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              {tr(
                'Chưa có bản ghi english-coach- trong khoảng thời gian này.',
                'No english-coach- rows in this date range.',
                '该日期范围内没有 english-coach- 记录。',
                'この期間に english-coach- の行がありません。',
                '이 기간에 english-coach- 행이 없습니다.'
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
