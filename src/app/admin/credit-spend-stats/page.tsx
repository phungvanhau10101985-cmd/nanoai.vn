import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiStatsDateFilter } from '../api-stats/api-stats-date-filter'
import { creditSpendFeatureLabel } from '../api-stats/api-stats-labels'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import {
  fetchAdminCreditSpendAggregateInRange,
  fetchAdminCreditSpendByFeatureInRange,
  fetchAdminCreditSpendByPeriodInRange,
  fetchAdminCreditSpendEventsInRange,
  type CreditSpendBucket,
} from '@/lib/db/admin-credit-spend-stats-pg'

export const metadata: Metadata = buildMetadata({
  title: 'Thống kê trừ credit',
  description: 'Nhật ký trừ credit theo tính năng — ngày, tháng, năm.',
  path: '/admin/credit-spend-stats',
  noIndex: true,
})

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatCredits(n: number, locale: string) {
  if (!Number.isFinite(n)) return '0'
  const maxFrac = n % 1 !== 0 ? 2 : 0
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale === 'ko' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  }).format(n)
}

function parseBucket(raw: string | undefined): CreditSpendBucket {
  if (raw === 'month' || raw === 'year') return raw
  return 'day'
}

export default async function AdminCreditSpendStatsPage({
  searchParams = {},
}: {
  searchParams?: { from?: string; to?: string; bucket?: string }
}) {
  const uiLocale = getCurrentWebLocale()
  const localeTag =
    uiLocale === 'en' ? 'en-US' : uiLocale === 'zh' ? 'zh-CN' : uiLocale === 'ja' ? 'ja-JP' : uiLocale === 'ko' ? 'ko-KR' : 'vi-VN'

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const fromParam = searchParams?.from?.trim()
  const toParam = searchParams?.to?.trim()
  const fromDate = fromParam || toYMD(thirtyDaysAgo)
  const toDate = toParam || toYMD(today)
  const bucket = parseBucket(searchParams?.bucket)

  const [aggResult, featureResult, periodResult, eventsResult] = await Promise.all([
    fetchAdminCreditSpendAggregateInRange(fromDate, toDate),
    fetchAdminCreditSpendByFeatureInRange(fromDate, toDate),
    fetchAdminCreditSpendByPeriodInRange(fromDate, toDate, bucket),
    fetchAdminCreditSpendEventsInRange(fromDate, toDate, 200),
  ])

  const aggErr = aggResult.error || featureResult.error || periodResult.error || eventsResult.error
  const agg = aggResult.data
  const featureRows = featureResult.rows
  const maxFeatureCredits = Math.max(...featureRows.map((r) => Math.abs(r.sumCredits)), 1)

  const bucketHref = (next: CreditSpendBucket) => {
    const p = new URLSearchParams()
    p.set('from', fromDate)
    p.set('to', toDate)
    p.set('bucket', next)
    return `/admin/credit-spend-stats?${p.toString()}`
  }

  const sourceLabel = (source: string) => {
    if (source === 'idempotent') {
      return tr('Coach / giáo trình', 'Coach / curriculum', '教练 / 课程', 'コーチ / 教材', '코치 / 교안')
    }
    if (source === 'refund') {
      return tr('Hoàn', 'Refund', '退还', '返金', '환불')
    }
    return tr('Trừ', 'Deduct', '扣减', '減算', '차감')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Thống kê trừ credit', 'Credit spend statistics', '积分消耗统计', 'クレジット消費統計', '크레딧 사용 통계')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Nhật ký trừ credit theo tính năng (múi giờ Việt Nam). Guest dùng thử không ghi sổ. Số credit là net (đã trừ hoàn nếu có).',
            'Credit spend ledger by feature (Vietnam timezone). Guest trials are not logged. Credits are net of refunds.',
            '按功能记录积分消耗（越南时区）。试用访客不记账。积分为净消耗（已扣退还）。',
            '機能別のクレジット消費ログ（ベトナム時間）。ゲスト試用は記録しません。返金後の純消費です。',
            '기능별 크레딧 사용 기록(베트남 시간). 게스트 체험은 기록하지 않습니다. 환불 반영 순사용량입니다.'
          )}
        </p>
        <p className="mt-1 text-sm">
          <Link href="/admin/credit-deposit-stats" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {tr('Thống kê nạp credit', 'Credit top-up stats', '充值统计', 'チャージ統計', '충전 통계')}
          </Link>
        </p>
      </div>

      <ApiStatsDateFilter
        defaultFrom={fromDate}
        defaultTo={toDate}
        basePath="/admin/credit-spend-stats"
        extraQuery={{ bucket }}
      />

      {aggErr ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">
              {tr('Lỗi', 'Error', '错误', 'エラー', '오류')}: {aggErr}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Lượt trừ', 'Spend events', '扣减次数', '減算回数', '차감 횟수')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{agg?.eventCount ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Khách (distinct)', 'Distinct users', '独立用户数', 'ユニークユーザー', '고유 사용자')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{agg?.distinctUsers ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Tính năng', 'Features', '功能数', '機能数', '기능 수')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{agg?.distinctFeatures ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Credit đã trừ (net)', 'Credits spent (net)', '净消耗积分', '純消費クレジット', '순사용 크레딧')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatCredits(agg?.sumCredits ?? 0, uiLocale)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {tr('Theo tính năng', 'By feature', '按功能', '機能別', '기능별')}
              </CardTitle>
              <CardDescription>
                {tr(
                  'Tính năng nào được dùng nhiều nhất trong khoảng đã chọn.',
                  'Which features were used most in the selected range.',
                  '所选范围内使用最多的功能。',
                  '選択期間で最も使われた機能。',
                  '선택한 기간에 가장 많이 쓰인 기능.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {featureRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tr(
                    'Chưa có lượt trừ trong khoảng này. Công cụ ảnh chỉ ghi sổ sau khi chạy migration.',
                    'No spend events in this range. Image tools start logging after the migration runs.',
                    '此范围内尚无扣减。图片工具仅在迁移后开始记账。',
                    'この期間に減算がありません。画像ツールはマイグレーション後から記録します。',
                    '이 구간에 차감 기록이 없습니다. 이미지 도구는 마이그레이션 이후부터 기록됩니다.'
                  )}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr('Tính năng', 'Feature', '功能', '機能', '기능')}</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Lượt trừ', 'Events', '次数', '回数', '횟수')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Khách', 'Users', '用户', 'ユーザー', '사용자')}
                      </TableHead>
                      <TableHead className="min-w-[140px]">{tr('Credit', 'Credits', '积分', 'クレジット', '크레딧')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {featureRows.map((row) => {
                      const pct = Math.min(100, (Math.abs(row.sumCredits) / maxFeatureCredits) * 100)
                      return (
                        <TableRow key={row.feature}>
                          <TableCell>
                            <div className="font-medium">{creditSpendFeatureLabel(row.feature)}</div>
                            <div className="text-xs text-muted-foreground font-mono">{row.feature}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{row.eventCount}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{row.distinctUsers}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 shrink-0 rounded bg-muted">
                                <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="tabular-nums text-xs">{formatCredits(row.sumCredits, uiLocale)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>
                    {tr('Theo ngày / tháng / năm', 'By day / month / year', '按日 / 月 / 年', '日 / 月 / 年', '일 / 월 / 년')}
                  </CardTitle>
                  <CardDescription>
                    {tr(
                      'Gom nhật ký trừ credit theo khoảng thời gian.',
                      'Group spend events by period.',
                      '按时间段汇总消耗。',
                      '期間で消費を集計。',
                      '기간별로 사용량을 집계합니다.'
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['day', 'month', 'year'] as const).map((b) => (
                    <Button key={b} asChild size="sm" variant={bucket === b ? 'default' : 'outline'}>
                      <Link href={bucketHref(b)}>
                        {b === 'day'
                          ? tr('Ngày', 'Day', '日', '日', '일')
                          : b === 'month'
                            ? tr('Tháng', 'Month', '月', '月', '월')
                            : tr('Năm', 'Year', '年', '年', '년')}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {periodResult.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tr('Không có dữ liệu trong khoảng này.', 'No data in this range.', '此范围内无数据。', 'この期間にデータがありません。', '이 구간에 데이터가 없습니다.')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {bucket === 'year'
                          ? tr('Năm', 'Year', '年', '年', '년')
                          : bucket === 'month'
                            ? tr('Tháng', 'Month', '月', '月', '월')
                            : tr('Ngày', 'Day', '日期', '日', '일')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Lượt trừ', 'Events', '次数', '回数', '횟수')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Khách', 'Users', '用户', 'ユーザー', '사용자')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Credit (net)', 'Credits (net)', '净积分', '純クレジット', '순 크레딧')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodResult.rows.map((row) => (
                      <TableRow key={row.periodKey}>
                        <TableCell className="whitespace-nowrap tabular-nums text-xs">{row.periodKey}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{row.eventCount}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{row.distinctUsers}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {formatCredits(row.sumCredits, uiLocale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr('Nhật ký gần đây', 'Recent ledger', '最近流水', '最近の記録', '최근 기록')}</CardTitle>
              <CardDescription>
                {tr(
                  'Tối đa 200 bản ghi mới nhất trong khoảng đã chọn.',
                  'Up to 200 most recent rows in the selected range.',
                  '所选范围内最多 200 条最新记录。',
                  '選択した期間で最大200件まで。',
                  '선택 구간에서 최신 200건까지.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {eventsResult.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tr('Không có dữ liệu trong khoảng này.', 'No data in this range.', '此范围内无数据。', 'この期間にデータがありません。', '이 구간에 데이터가 없습니다.')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{tr('Thời điểm', 'Time', '时间', '時刻', '시각')}</TableHead>
                      <TableHead>{tr('Email', 'Email', '邮箱', 'メール', '이메일')}</TableHead>
                      <TableHead>{tr('Tính năng', 'Feature', '功能', '機能', '기능')}</TableHead>
                      <TableHead className="text-right whitespace-nowrap">{tr('Credit', 'Credits', '积分', 'クレジット', '크레딧')}</TableHead>
                      <TableHead>{tr('Nguồn', 'Source', '来源', 'ソース', '출처')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventsResult.rows.map((row) => {
                      const at = row.created_at || ''
                      const atLabel =
                        at && !Number.isNaN(Date.parse(at))
                          ? new Date(at).toLocaleString(uiLocale === 'vi' ? 'vi-VN' : localeTag)
                          : '—'
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-xs">{atLabel}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs" title={row.email ?? ''}>
                            {row.email ?? '—'}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">{creditSpendFeatureLabel(row.feature)}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{row.feature}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {formatCredits(row.amount, uiLocale)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{sourceLabel(row.source)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
