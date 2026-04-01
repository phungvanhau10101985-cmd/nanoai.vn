import Link from 'next/link'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { calcCostVnd, USD_TO_VND } from '../api-cost'
import { mergeApiFeatureLabelsForLogs } from '../api-stats-labels'
import { API_FEATURE_GROUP_LABELS, resolveApiFeatureGroupId, type ApiFeatureGroupId } from '../feature-groups'
import { rollupApiUsageByFeatureGroup, type UsageAggRow } from '../group-aggregates'
import { aggregateLanguageCoachCredits } from '../language-coach-financials'
import { ApiStatsDateFilter } from '../api-stats-date-filter'
import { fetchAllApiUsageLogsInRange } from '../fetch-api-usage-logs-range'

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function sumMusicChargedCredits(
  admin: ReturnType<typeof createSupabaseClient<Database>>,
  fromIso: string,
  toIso: string
): Promise<number> {
  const pageSize = 1000
  let offset = 0
  let sum = 0
  for (;;) {
    const { data, error } = await admin
      .from('music_generations')
      .select('charged_credits')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error || !data?.length) break
    for (const row of data) {
      const n = Number((row as { charged_credits?: number | string }).charged_credits ?? 0)
      if (Number.isFinite(n)) sum += n
    }
    if (data.length < pageSize) break
    offset += pageSize
    if (offset > 500_000) break
  }
  return sum
}

function groupLabel(
  id: ApiFeatureGroupId,
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
) {
  const L = API_FEATURE_GROUP_LABELS[id]
  return tr(L.vi, L.en, L.zh, L.ja, L.ko)
}

export default async function AdminApiStatsBreakdownPage({
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
  const fromDate = params.from?.trim() || toYMD(thirtyDaysAgo)
  const toDate = params.to?.trim() || toYMD(today)

  const rangeStart = new Date(fromDate)
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(toDate)
  rangeEnd.setHours(23, 59, 59, 999)
  const fromIso = fromDate + 'T00:00:00'
  const toIso = toDate + 'T23:59:59.999'

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [logFetch, { data: languageCoachCreditEvents }, { data: allPayments }, musicCreditsSum] = await Promise.all([
    fetchAllApiUsageLogsInRange(adminSupabase, fromIso, toIso),
    adminSupabase.from('language_coach_credit_events').select('charge_type, amount').gte('created_at', fromIso).lte('created_at', toIso),
    adminSupabase.from('payments').select('amount, completed_at, created_at').eq('status', 'completed'),
    sumMusicChargedCredits(adminSupabase, fromIso, toIso),
  ])

  const { data: logsRaw, error, count: apiLogTotalCount } = logFetch

  if (error) {
    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight">
          {tr('Báo cáo API phân cấp', 'Hierarchical API report', '分层 API 报表', 'API階層レポート', '계층형 API 보고서')}
        </h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">
              {tr('Lỗi', 'Error', '错误', 'エラー', '오류')}: {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const logsList = logsRaw || []
  const displayedLogCount = logsList.length
  const totalLogsMatchingRange =
    typeof apiLogTotalCount === 'number' && apiLogTotalCount >= 0 ? apiLogTotalCount : displayedLogCount
  const featureLabelsMerged = mergeApiFeatureLabelsForLogs(logsList.map((l) => l.feature))
  const {
    groups,
    siteTotals,
    siteByFeature,
    siteByFeatureModels,
    siteByModel,
    siteByModelFeatures,
    siteModelDistinctGroupCount,
  } = rollupApiUsageByFeatureGroup(logsList, calcCostVnd)

  const revenueInRange =
    allPayments
      ?.filter((p) => {
        const d = (p as { completed_at?: string; created_at?: string }).completed_at ?? (p as { created_at?: string }).created_at
        if (!d) return false
        const dt = new Date(d)
        return dt >= rangeStart && dt <= rangeEnd
      })
      .reduce((s, p) => s + (p.amount || 0), 0) ?? 0

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

  const coachCreditAgg = aggregateLanguageCoachCredits(languageCoachCreditEvents || [])
  const musicCredits = musicCreditsSum
  const musicCreditsVnd = Math.round(musicCredits * CREDIT_UNIT_PRICE_VND)
  const coachCreditsTotalVnd = coachCreditAgg.liveCreditsVnd + coachCreditAgg.presetCreditsVnd
  const loggedCreditsVnd = coachCreditsTotalVnd + musicCreditsVnd

  const formatNum = (n: number) => n.toLocaleString('vi-VN')
  const formatVnd = (n: number) => `${n.toLocaleString('vi-VN')}₫`
  const rangeLabel =
    fromDate === toDate
      ? new Date(fromDate).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : `${new Date(fromDate).toLocaleDateString('vi-VN')} – ${new Date(toDate).toLocaleDateString('vi-VN')}`

  const sortEntries = (rec: Record<string, UsageAggRow>) =>
    Object.entries(rec).sort((a, b) => b[1].costVnd - a[1].costVnd)

  const modelSubTable = (models: Record<string, UsageAggRow>) => {
    const rows = sortEntries(models)
    if (rows.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-3 px-2 italic">
          {tr('Không có dòng model.', 'No model rows.', '无模型行。', 'モデル行がありません。', '모델 행 없음.')}
        </p>
      )
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">{tr('Lượt', 'Calls', '次数', '回数', '횟수')}</TableHead>
            <TableHead className="text-right">2K</TableHead>
            <TableHead className="text-right">4K</TableHead>
            <TableHead className="text-right">In</TableHead>
            <TableHead className="text-right">Out</TableHead>
            <TableHead className="text-right">{tr('Chi phí', 'Cost', '费用', 'コスト', '비용')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([model, st]) => (
            <TableRow key={model}>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {model}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{formatNum(st.calls)}</TableCell>
              <TableCell className="text-right text-sky-600">{formatNum(st.calls2K)}</TableCell>
              <TableCell className="text-right text-amber-600">{formatNum(st.calls4K)}</TableCell>
              <TableCell className="text-right">{formatNum(st.promptTokens)}</TableCell>
              <TableCell className="text-right">{formatNum(st.outputTokens)}</TableCell>
              <TableCell className="text-right font-medium text-amber-700">{formatVnd(st.costVnd)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  const sumGroupCostVnd = groups.reduce((s, g) => s + g.totals.costVnd, 0)
  const costReconcileOk = siteTotals.costVnd === sumGroupCostVnd
  const otherGroup = groups.find((g) => g.id === 'other')
  const otherFeatures =
    otherGroup && Object.keys(otherGroup.byFeature).length > 0
      ? Object.keys(otherGroup.byFeature).sort()
      : []

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground mb-2">
          <Link href="/admin/api-stats" className="text-primary underline underline-offset-2 hover:text-primary/80">
            ← {tr('Thống kê API', 'API statistics', 'API 统计', 'API統計', 'API 통계')}
          </Link>
        </p>
        <h2 className="text-3xl font-bold tracking-tight">
          {tr(
            'Báo cáo phân cấp: nhóm tính năng → tính năng → model',
            'Hierarchical report: feature group → feature → model',
            '分层报表：功能组 → 功能 → 模型',
            '階層レポート：機能グループ→機能→モデル',
            '계층 보고서: 기능 그룹→기능→모델'
          )}
        </h2>
        <p className="text-muted-foreground mt-1">
          {tr(
            'Nguồn: toàn bộ api_usage_log trong khoảng ngày (tải phân trang phía server). Model không có trong bảng giá dùng mức flash-preview. Lyria / Veo chỉ ghi “có lượt gọi” (token tối thiểu) — chưa có usage chi tiết từ API.',
            'Source: all api_usage_log rows in range (paged server-side). Unknown models use flash-preview. Lyria/Veo log call counts with minimal tokens — no detailed usage from API.',
            '来源：日期内全部 api_usage_log（服务端分页）。未知模型按 flash-preview。Lyria/Veo 仅记调用（token 占位）— API 无详细用量。',
            'ソース: 期間内の api_usage_log 全件（ページ取得）。未登録は flash-preview。Lyria/Veo は呼び出しのみ（トークン最小）。',
            '출처: 기간 내 api_usage_log 전체(페이징). 미등록 모델 flash-preview. Lyria/Veo는 호출만(최소 토큰).'
          )}
        </p>
      </div>

      <ApiStatsDateFilter
        key={`${fromDate}-${toDate}`}
        defaultFrom={fromDate}
        defaultTo={toDate}
        basePath="/admin/api-stats/breakdown"
      />

      {displayedLogCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {tr('Tổng', 'Total', '共', '合計', '총')}{' '}
          <strong>{formatNum(totalLogsMatchingRange)}</strong>{' '}
          {tr('bản ghi api_usage_log trong khoảng ngày.', 'api_usage_log rows in the date range.', '条 api_usage_log。', '件の api_usage_log。', '건 api_usage_log.')}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {tr('Tóm tắt theo nhóm tính năng', 'Summary by feature group', '按功能组汇总', '機能グループ要約', '기능 그룹 요약')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {tr(
              'Phân bổ lượt gọi và chi phí API (ước tính) theo từng nhóm; cộng các nhóm phải khớp tổng toàn site.',
              'Calls and estimated API cost by group; group sums should match site totals.',
              '各组的调用与估算 API 费用；各组之和应等于全站总计。',
              'グループ別の呼び出しとAPIコスト（概算）；合計はサイト全体と一致。',
              '그룹별 호출·API 비용(추정); 합계는 사이트 전체와 일치.'
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">{tr('Không có log.', 'No logs.', '无日志。', 'ログなし。', '로그 없음.')}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('Nhóm', 'Group', '分组', 'グループ', '그룹')}</TableHead>
                    <TableHead className="text-right">{tr('Lượt', 'Calls', '次数', '回数', '횟수')}</TableHead>
                    <TableHead className="text-right">{tr('Chi phí API', 'API cost', 'API 费用', 'APIコスト', 'API 비용')}</TableHead>
                    <TableHead className="text-right">{tr('% chi phí', '% of cost', '%费用', '費用%', '비용%')}</TableHead>
                    <TableHead className="text-right">{tr('Số feature', 'Features', '功能数', '機能数', '기능 수')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g) => {
                    const featCount = Object.keys(g.byFeature).length
                    const pct =
                      siteTotals.costVnd > 0 ? (100 * g.totals.costVnd) / siteTotals.costVnd : g.totals.costVnd > 0 ? 100 : 0
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{groupLabel(g.id, tr)}</TableCell>
                        <TableCell className="text-right">{formatNum(g.totals.calls)}</TableCell>
                        <TableCell className="text-right text-amber-800 font-medium">{formatVnd(g.totals.costVnd)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{pct.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{formatNum(featCount)}</TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>{tr('Tổng (toàn site)', 'Total (site)', '全站合计', '合計', '합계')}</TableCell>
                    <TableCell className="text-right">{formatNum(siteTotals.calls)}</TableCell>
                    <TableCell className="text-right text-amber-900">{formatVnd(siteTotals.costVnd)}</TableCell>
                    <TableCell className="text-right">{siteTotals.costVnd > 0 ? '100%' : '—'}</TableCell>
                    <TableCell className="text-right">{formatNum(Object.keys(siteByFeature).length)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className={`text-xs ${costReconcileOk ? 'text-emerald-800' : 'text-destructive'}`}>
                {costReconcileOk ? (
                  tr(
                    'Đối soát: tổng chi phí các nhóm = chi phí toàn site (khớp).',
                    'Check: sum of group costs equals site total (OK).',
                    '校验：各组费用之和 = 全站费用。',
                    '検算: グループ計 = サイト合計。',
                    '검산: 그룹 합계 = 사이트 합계.'
                  )
                ) : (
                  <>
                    {tr(
                      'Lỗi đối soát: tổng nhóm ≠ tổng site —',
                      'Reconcile error: groups sum ≠ site —',
                      '校验错误：组之和不等于全站 —',
                      '検算エラー:',
                      '검산 오류:'
                    )}{' '}
                    {formatVnd(sumGroupCostVnd)} ≠ {formatVnd(siteTotals.costVnd)}
                  </>
                )}
              </p>
              {otherFeatures.length > 0 ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">
                    {tr('Feature trong nhóm “Khác” (cân nhắc map vào feature-groups.ts):', 'Features in “Other” (consider mapping in feature-groups.ts):', '“其他”组中的 feature（可在 feature-groups.ts 映射）：', '「その他」の機能（feature-groups.ts でマップ検討）:', '"기타" 기능(feature-groups.ts 매핑 검토):')}
                  </p>
                  <p className="font-mono break-all">{otherFeatures.join(', ')}</p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader>
          <CardTitle>{tr('Tổng toàn site (trong khoảng ngày)', 'Site totals (date range)', '全站合计（日期范围）', 'サイト合計（期間）', '사이트 합계(기간)')}</CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tr('Thu (nạp tiền)', 'Revenue (top-ups)', '收入（充值）', '入金', '매출(충전)')}</p>
              <p className="text-2xl font-bold text-emerald-700">{formatVnd(revenueInRange)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tr('Chi API (ước tính)', 'Est. API cost', 'API 支出（估算）', 'APIコスト（概算）', 'API 비용(추정)')}</p>
              <p className="text-2xl font-bold text-amber-700">{formatVnd(apiCostVndInRange)}</p>
              <p className="text-xs text-muted-foreground">
                ~{apiCostUsdInRange.toFixed(4)} USD • {formatNum(displayedLogCount)} {tr('lượt', 'calls', '次', '回', '회')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tr('Lợi nhuận', 'Profit', '利润', '利益', '이익')}</p>
              <p className={`text-2xl font-bold ${profitInRange >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatVnd(profitInRange)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tr('Tokens (input / output)', 'Tokens (in / out)', 'Tokens（入/出）', 'トークン（入/出）', '토큰(입/출)')}</p>
              <p className="text-lg font-semibold">
                {formatNum(siteTotals.promptTokens)} / {formatNum(siteTotals.outputTokens)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-violet-200 bg-violet-50/20">
        <CardHeader>
          <CardTitle>{tr('Credit đã thu (có log)', 'Credits with ledger', '已收积分（有记录）', 'クレジット（記録あり）', '크레딧(기록 있음)')}</CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          <p className="text-xs text-muted-foreground pt-1">
            {tr(
              'Quy đổi VND từ số credit đã ghi nhận trừ (coach + nhạc). Khác mục “Thu (nạp tiền)” — đó là tiền người dùng đã chuyển khi nạp.',
              'VND from logged credit deductions (coach + music). “Revenue (top-ups)” is money users paid when topping up.',
              '由已记录的积分扣减换算 VND（教练+音乐）。与“收入（充值）”不同——后者为用户充值实付。',
              '記録されたクレジット控除からVND換算（コーチ+音楽）。「入金」とは別（チャージ実額）。',
              '기록된 크레딧 차감을 VND로 환산(코치+음악). "매출(충전)"과 다름 — 실제 충전 결제액.'
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">{tr('Học ngoại ngữ AI (live)', 'Language coach (live)', '外语学习（直播）', '語学—ライブ', '외국어—라이브')}</p>
              <p className="text-xl font-bold text-emerald-800">{formatVnd(coachCreditAgg.liveCreditsVnd)}</p>
              <p className="text-xs text-muted-foreground">{coachCreditAgg.liveCredits.toFixed(2)} credits</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tr('Học ngoại ngữ AI (bài có sẵn)', 'Language coach (preset)', '外语学习（现成课）', '語学—プリセット', '외국어—프리셋')}</p>
              <p className="text-xl font-bold text-violet-900">{formatVnd(coachCreditAgg.presetCreditsVnd)}</p>
              <p className="text-xs text-muted-foreground">{coachCreditAgg.presetCredits.toFixed(2)} credits</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tr('Nhạc AI (music_generations)', 'Music AI', '音乐 AI', '音楽AI', '음악 AI')}</p>
              <p className="text-xl font-bold text-indigo-900">{formatVnd(musicCreditsVnd)}</p>
              <p className="text-xs text-muted-foreground">{musicCredits.toFixed(2)} credits</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tr('Cộng (ước tính VND)', 'Sum (est. VND)', '合计（估算 VND）', '合計（VND換算）', '합계(VND 환산)')}</p>
              <p className="text-xl font-bold">{formatVnd(loggedCreditsVnd)}</p>
              <p className="text-xs text-muted-foreground">1 credit = {CREDIT_UNIT_PRICE_VND.toLocaleString('vi-VN')}₫</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t pt-3">
            {tr(
              'Chưa gồm: các luồng chỉ trừ credits.balance mà không ghi bảng riêng (ví dụ một số công cụ ảnh). Tiền nạp có thể còn trong ví chưa tiêu.',
              'Excludes flows that only deduct credits.balance without a dedicated table (e.g. some image tools). Top-ups may remain unused in wallets.',
              '不含：仅扣 credits 且无独立表的流程。充值可能尚未消费。',
              '含まない: 専用テーブルなしで balance のみ減算するフロー。チャージは未使用の可能性。',
              '제외: 전용 테이블 없이 balance만 차감하는 흐름. 충전액은 미사용일 수 있음.'
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {tr(
              'Toàn site — tính năng → model (chi tiết)',
              'Site-wide — feature → model (detail)',
              '全站 — 功能 → 模型（明细）',
              'サイト全体 — 機能→モデル（詳細）',
              '사이트 전체 — 기능→모델(상세)'
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {tr(
              'Mỗi dòng là một feature; mở ra để xem từng model dùng bao nhiêu lượt và chi phí.',
              'Each row is a feature; expand to see per-model calls and cost.',
              '每行一个功能；展开查看各模型的调用与费用。',
              '各行が機能。開いてモデル別の回数とコストを表示。',
              '행마다 기능. 펼쳐 모델별 호출·비용 확인.'
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortEntries(siteByFeature).length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">
              {tr('Không có dữ liệu.', 'No data.', '无数据。', 'データなし。', '데이터 없음.')}
            </p>
          ) : (
            sortEntries(siteByFeature).map(([feature, st]) => (
              <details key={`site-${feature}`} className="rounded-lg border bg-card">
                <summary className="cursor-pointer list-none px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm hover:bg-muted/40 rounded-lg">
                  <span>
                    <span className="font-medium">{featureLabelsMerged[feature] || feature}</span>
                    <span className="text-xs text-muted-foreground font-mono ml-2">{feature}</span>
                  </span>
                  <span className="text-muted-foreground flex flex-wrap gap-2">
                    <span>
                      {formatNum(st.calls)} {tr('lượt', 'calls', '次', '回', '회')}
                    </span>
                    <span className="font-medium text-amber-700">{formatVnd(st.costVnd)}</span>
                  </span>
                </summary>
                <div className="border-t px-3 pb-3 pt-2 overflow-x-auto">
                  {modelSubTable(siteByFeatureModels[feature] || {})}
                </div>
              </details>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {tr(
              'Toàn site — model → tính năng → nhóm',
              'Site-wide — model → feature → group',
              '全站 — 模型 → 功能 → 分组',
              'サイト全体 — モデル→機能→グループ',
              '사이트 전체 — 모델→기능→그룹'
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {tr(
              'Đảo chiều: chọn model trước, xem từng feature và nhóm tính năng tương ứng.',
              'Inverse view: pick a model first, then features and their feature groups.',
              '反向：先选模型，再看各功能及所属功能组。',
              '逆順：モデルを選び、機能と所属グループを表示。',
              '역방향: 모델별 기능·소속 그룹.'
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortEntries(siteByModel).length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">
              {tr('Không có dữ liệu.', 'No data.', '无数据。', 'データなし。', '데이터 없음.')}
            </p>
          ) : (
            sortEntries(siteByModel).map(([model, st]) => (
              <details key={`inv-${model}`} className="rounded-lg border bg-card">
                <summary className="cursor-pointer list-none px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm hover:bg-muted/40 rounded-lg">
                  <Badge variant="outline" className="font-mono text-xs">
                    {model}
                  </Badge>
                  <span className="text-muted-foreground flex flex-wrap gap-2">
                    <span>
                      {formatNum(st.calls)} {tr('lượt', 'calls', '次', '回', '회')}
                    </span>
                    <span className="font-medium text-amber-700">{formatVnd(st.costVnd)}</span>
                    <span className="text-xs">
                      {siteModelDistinctGroupCount[model] ?? 0}{' '}
                      {tr('nhóm', 'groups', '个组', 'グループ', '그룹')}
                    </span>
                  </span>
                </summary>
                <div className="border-t px-3 pb-3 pt-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tr('Tính năng', 'Feature', '功能', '機能', '기능')}</TableHead>
                        <TableHead>{tr('Nhóm', 'Group', '分组', 'グループ', '그룹')}</TableHead>
                        <TableHead className="text-right">{tr('Lượt', 'Calls', '次数', '回数', '횟수')}</TableHead>
                        <TableHead className="text-right">2K</TableHead>
                        <TableHead className="text-right">4K</TableHead>
                        <TableHead className="text-right">In</TableHead>
                        <TableHead className="text-right">Out</TableHead>
                        <TableHead className="text-right">{tr('Chi phí', 'Cost', '费用', 'コスト', '비용')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortEntries(siteByModelFeatures[model] || {}).map(([feature, row]) => {
                        const gid = resolveApiFeatureGroupId(feature)
                        return (
                          <TableRow key={`${model}-${feature}`}>
                            <TableCell>
                              <span className="font-medium">{featureLabelsMerged[feature] || feature}</span>
                              <br />
                              <span className="text-xs text-muted-foreground font-mono">{feature}</span>
                            </TableCell>
                            <TableCell className="text-sm">{groupLabel(gid, tr)}</TableCell>
                            <TableCell className="text-right">{formatNum(row.calls)}</TableCell>
                            <TableCell className="text-right text-sky-600">{formatNum(row.calls2K)}</TableCell>
                            <TableCell className="text-right text-amber-600">{formatNum(row.calls4K)}</TableCell>
                            <TableCell className="text-right">{formatNum(row.promptTokens)}</TableCell>
                            <TableCell className="text-right">{formatNum(row.outputTokens)}</TableCell>
                            <TableCell className="text-right font-medium text-amber-700">{formatVnd(row.costVnd)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </details>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('Theo nhóm → chi tiết', 'By group → details', '按分组 → 明细', 'グループ別→詳細', '그룹별→상세')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {tr(
              'Mở nhóm → mở từng tính năng để xem model chi tiết; cuối nhóm vẫn có bảng gộp theo model.',
              'Open a group → each feature for per-model detail; group-level model totals remain below.',
              '打开分组→各功能查看模型明细；组末仍有按模型汇总表。',
              'グループ→各機能でモデル詳細。末尾にモデル集計。',
              '그룹→기능별 모델 상세. 하단에 모델 합계 표.'
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {groups.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">
              {tr('Không có log trong khoảng thời gian này.', 'No logs in this range.', '此时间段无日志。', 'この期間にログがありません。', '이 기간에 로그가 없습니다.')}
            </p>
          ) : (
            groups.map((g) => (
              <details key={g.id} className="rounded-lg border bg-card">
                <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-muted/40 rounded-lg">
                  <span className="font-semibold">{groupLabel(g.id, tr)}</span>
                  <span className="text-sm text-muted-foreground flex flex-wrap gap-3">
                    <span>
                      {formatNum(g.totals.calls)} {tr('lượt', 'calls', '次', '回', '회')}
                    </span>
                    <span className="font-medium text-amber-700">{formatVnd(g.totals.costVnd)}</span>
                    <span>
                      ~{formatVnd(g.totals.calls ? Math.round(g.totals.costVnd / g.totals.calls) : 0)}/{tr('lượt', 'call', '次', '回', '회')}
                    </span>
                  </span>
                </summary>
                <div className="border-t px-4 pb-4 pt-3 space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      {tr('Tính năng → model (trong nhóm)', 'Feature → model (in group)', '功能→模型（组内）', '機能→モデル（グループ内）', '기능→모델(그룹 내)')}
                    </h4>
                    <div className="space-y-2">
                      {sortEntries(g.byFeature).map(([feature, st]) => (
                        <details key={`${g.id}-${feature}`} className="rounded-md border">
                          <summary className="cursor-pointer list-none px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm hover:bg-muted/30">
                            <span>
                              <span className="font-medium">{featureLabelsMerged[feature] || feature}</span>
                              <span className="text-xs text-muted-foreground font-mono ml-2">{feature}</span>
                            </span>
                            <span className="text-muted-foreground flex flex-wrap gap-2">
                              <span>
                                {formatNum(st.calls)} {tr('lượt', 'calls', '次', '回', '회')}
                              </span>
                              <span className="font-medium text-amber-700">{formatVnd(st.costVnd)}</span>
                            </span>
                          </summary>
                          <div className="border-t px-2 pb-2 pt-2 overflow-x-auto">
                            {modelSubTable(g.byFeatureModels[feature] || {})}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      {tr('Gộp theo model (cả nhóm)', 'By model (group total)', '按模型汇总（整组）', 'モデル集計（グループ全体）', '모델 합계(그룹 전체)')}
                    </h4>
                    {modelSubTable(g.byModel)}
                  </div>
                </div>
              </details>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('Model — toàn site (tóm tắt)', 'Models — site-wide (summary)', '模型 — 全站（汇总）', 'モデル—サイト全体（要約）', '모델—사이트 전체(요약)')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {tr(
              'Cùng số liệu với bảng gộp trong rollup; cột “nhóm” = số nhóm tính năng khác nhau model đó tham gia.',
              'Same totals as rollup; “groups” = distinct feature groups that model appears in.',
              '与汇总一致；“组数”= 该模型出现的不同功能组数。',
              'ロールアップと一致。「グループ数」= 当該モデルが現れる機能グループ数。',
              '롤업과 동일. "그룹 수"= 해당 모델이 나타난 서로 다른 기능 그룹 수.'
            )}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">{tr('Lượt', 'Calls', '次数', '回数', '횟수')}</TableHead>
                <TableHead className="text-right">{tr('Chi phí', 'Cost', '费用', 'コスト', '비용')}</TableHead>
                <TableHead className="text-right">{tr('Số nhóm', 'Groups', '组数', 'グループ数', '그룹 수')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortEntries(siteByModel).map(([model, st]) => (
                <TableRow key={model}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {model}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatNum(st.calls)}</TableCell>
                  <TableCell className="text-right text-amber-700 font-medium">{formatVnd(st.costVnd)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{siteModelDistinctGroupCount[model] ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
