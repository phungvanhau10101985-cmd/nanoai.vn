import Link from 'next/link'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ApiStatsDateFilter } from '../api-stats-date-filter'
import { LogsTableWithDetail } from '../logs-table-with-detail'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { calcCostVnd, USD_TO_VND } from '../api-cost'
import { buildCurriculumFeatureLabelsForLogs } from '../curriculum-feature-labels'

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

export default async function AdminCurriculumApiStatsPage({
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

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: logs, error } = await adminSupabase
    .from('api_usage_log')
    .select('id, model, feature, prompt_token_count, candidates_token_count, total_token_count, image_size, created_at')
    .like('feature', 'curriculum-%')
    .gte('created_at', fromDate + 'T00:00:00')
    .lte('created_at', toDate + 'T23:59:59.999')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight">
          {tr('Tạo giáo trình — API', 'Curriculum builder — API', '创建课程 — API', '授業作成 — API', '교안 만들기 — API')}
        </h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{tr('Lỗi', 'Error', '错误', 'エラー', '오류')}: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const logsList = logs || []
  const curriculumFeatureLabels = buildCurriculumFeatureLabelsForLogs(logsList.map((l) => l.feature))

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
            'Tạo giáo trình — Chi tiết API (Gemini)',
            'Curriculum builder — API detail (Gemini)',
            '创建课程 — API 明细（Gemini）',
            '授業作成 — API詳細（Gemini）',
            '교안 만들기 — API 상세 (Gemini)'
          )}
        </h2>
        <p className="text-muted-foreground mt-1">
          {tr(
            'Chỉ bản ghi feature bắt đầu bằng curriculum- • Tối đa 5000 bản ghi • 1 USD = 25.000₫',
            'Only rows where feature starts with curriculum- • Up to 5000 records • 1 USD = 25,000₫',
            '仅 feature 以 curriculum- 开头的记录 • 最多5000条 • 1 USD = 25,000₫',
            'feature が curriculum- で始まる行のみ • 最大5000件 • 1 USD = 25,000₫',
            'feature가 curriculum-로 시작하는 행만 • 최대 5000건 • 1 USD = 25,000₫'
          )}
        </p>
        <p className="text-sm mt-2">
          <Link href="/admin/api-stats" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {tr('← Thống kê API tổng hợp', '← Combined API statistics', '← 综合 API 统计', '← 統合API統計', '← 통합 API 통계')}
          </Link>
        </p>
        <p className="text-xs text-amber-800/90 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
          {tr(
            'OpenAI (analyze-slides khi bật SLIDE_USE_OPENAI), tìm ảnh Google GenAI grounding, DeepSeek, và Pexels không ghi vào bảng này. Chỉ các lượt @google/generative-ai có usageMetadata mới được log.',
            'OpenAI (analyze-slides when SLIDE_USE_OPENAI), Google GenAI grounding image search, DeepSeek, and Pexels are not logged here. Only @google/generative-ai calls with usageMetadata are recorded.',
            '启用 SLIDE_USE_OPENAI 时的 OpenAI、Google GenAI 搜图、DeepSeek、Pexels 不在此表。仅记录带 usageMetadata 的 @google/generative-ai 调用。',
            'SLIDE_USE_OPENAI 時の OpenAI、Google GenAI 画像検索、DeepSeek、Pexels は含まれません。usageMetadata 付き @google/generative-ai のみ。',
            'SLIDE_USE_OPENAI 시 OpenAI, Google GenAI 이미지 검색, DeepSeek, Pexels는 미포함. usageMetadata 있는 @google/generative-ai만 기록.'
          )}
        </p>
      </div>

      <ApiStatsDateFilter
        key={`${fromDate}-${toDate}`}
        defaultFrom={fromDate}
        defaultTo={toDate}
        basePath="/admin/api-stats/curriculum"
      />

      <Card className="border-violet-200 bg-violet-50/30">
        <CardHeader>
          <CardTitle>
            {tr('Tổng chi phí API Gemini (giáo trình)', 'Total Gemini API cost (curriculum)', 'Gemini API 总费用（课程）', 'Gemini API合計（授業）', 'Gemini API 총액 (교안)')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-violet-800">{formatVnd(apiCostVndInRange)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            ~{apiCostUsdInRange.toFixed(4)} USD • {logsList.length}{' '}
            {tr('lượt gọi đã log', 'logged calls', '条已记录调用', '件の記録済み呼び出し', '기록된 호출')}
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
                        <span className="font-medium text-violet-800">{formatVnd(stats.costVnd)}</span>
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
            <p className="text-sm text-muted-foreground">{tr('Khóa feature curriculum-*', 'curriculum-* feature keys', 'curriculum-* 功能键', 'curriculum-* キー', 'curriculum-* 키')}</p>
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
                        <span className="font-medium">{curriculumFeatureLabels[feature] || feature}</span>
                        <br />
                        <span className="text-xs text-muted-foreground font-mono">{feature}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatNum(stats.calls)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.promptTokens)}</TableCell>
                      <TableCell className="text-right">{formatNum(stats.outputTokens)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-violet-800">{formatVnd(stats.costVnd)}</span>
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
            {tr(
              '100 bản ghi mới nhất (curriculum-)',
              'Latest 100 rows (curriculum-)',
              '最新100条（curriculum-）',
              '最新100件（curriculum-）',
              '최신 100건 (curriculum-)'
            )}
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
              featureLabels={curriculumFeatureLabels}
            />
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              {tr(
                'Chưa có bản ghi curriculum- trong khoảng thời gian này.',
                'No curriculum- rows in this date range.',
                '该日期范围内没有 curriculum- 记录。',
                'この期間に curriculum- の行がありません。',
                '이 기간에 curriculum- 행이 없습니다.'
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
