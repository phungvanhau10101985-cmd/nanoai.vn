import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiStatsDateFilter } from '../api-stats/api-stats-date-filter'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import {
  fetchAdminCreditDepositAggregateInRange,
  fetchAdminCreditDepositRowsInRange,
} from '@/lib/db/admin-credit-deposit-stats-pg'

export const metadata: Metadata = buildMetadata({
  title: 'Thống kê nạp credit',
  description: 'Lịch sử và tổng hợp giao dịch nạp credit (đã hoàn thành).',
  path: '/admin/credit-deposit-stats',
  noIndex: true,
})

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatVnd(n: number, locale: string) {
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale === 'ko' ? 'ko-KR' : 'en-US').format(
    Math.round(n)
  )
}

function formatCredits(n: number, locale: string) {
  if (!Number.isFinite(n)) return '0'
  const maxFrac = n % 1 !== 0 ? 2 : 0
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale === 'ko' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  }).format(n)
}

export default async function AdminCreditDepositStatsPage({
  searchParams = {},
}: {
  searchParams?: { from?: string; to?: string }
}) {
  const uiLocale = getCurrentWebLocale()
  const localeTag = uiLocale === 'en' ? 'en-US' : uiLocale === 'zh' ? 'zh-CN' : uiLocale === 'ja' ? 'ja-JP' : uiLocale === 'ko' ? 'ko-KR' : 'vi-VN'

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

  const fromIso = fromDate + 'T00:00:00'
  const toIso = toDate + 'T23:59:59.999'

  const [aggResult, rowsResult] = await Promise.all([
    fetchAdminCreditDepositAggregateInRange(fromIso, toIso),
    fetchAdminCreditDepositRowsInRange(fromIso, toIso, 500),
  ])

  const aggErr = aggResult.error || rowsResult.error
  const agg = aggResult.data

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Thống kê lịch sử nạp credit', 'Credit top-up statistics', '充值积分统计', 'クレジットチャージ統計', '크레딧 충전 통계')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Chỉ tính giao dịch thanh toán đã hoàn thành (bảng payments). Mốc thời gian: lúc hoàn thành hoặc tạo lệnh nếu chưa có completed_at.',
            'Only completed payment rows (payments table). Time stamp: completion time, or created time if completed_at is null.',
            '仅统计已完成的支付记录（payments 表）。时间：完成时间；若无 completed_at 则用创建时间。',
            '完了済みの支払い（payments）のみ。時刻は完了日時、なければ作成日時。',
            '완료된 결제(payments)만 집계. 시각은 완료 시각, 없으면 생성 시각.'
          )}
        </p>
      </div>

      <ApiStatsDateFilter defaultFrom={fromDate} defaultTo={toDate} basePath="/admin/credit-deposit-stats" />

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
                  {tr('Giao dịch đã xong', 'Completed payments', '已完成笔数', '完了取引数', '완료 건수')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{agg?.completedCount ?? 0}</CardTitle>
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
                  {tr('Tổng tiền nạp (VND)', 'Total amount (VND)', '充值总额（VND）', '入金合計（VND）', '총 입금액(VND)')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatVnd(agg?.sumAmountVnd ?? 0, uiLocale)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Tổng credit cộng', 'Total credits added', '发放的积分总和', '付与クレジット合計', '충전된 크레딧 합계')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatCredits(agg?.sumCreditsAdded ?? 0, uiLocale)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{tr('Chi tiết giao dịch', 'Transaction detail', '交易明细', '取引一覧', '거래 목록')}</CardTitle>
              <CardDescription>
                {tr(
                  'Tối đa 500 bản ghi mới nhất trong khoảng đã chọn.',
                  'Up to 500 most recent rows in the selected range.',
                  '所选范围内最多 500 条最新记录。',
                  '選択した期間で最大500件まで。',
                  '선택 구간에서 최신 500건까지.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {rowsResult.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tr('Không có dữ liệu trong khoảng này.', 'No data in this range.', '此范围内无数据。', 'この期間にデータがありません。', '이 구간에 데이터가 없습니다.')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        {tr('Hoàn thành', 'Completed', '完成时间', '完了', '완료')}
                      </TableHead>
                      <TableHead>{tr('Email', 'Email', '邮箱', 'メール', '이메일')}</TableHead>
                      <TableHead>{tr('Tên hiển thị', 'Display name', '显示名称', '表示名', '표시 이름')}</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Tiền (VND)', 'Amount (VND)', '金额', '金額', '금액')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">{tr('Credits', 'Credits', '积分', 'クレジット', '크레딧')}</TableHead>
                      <TableHead className="min-w-[120px]">{tr('Mã GD', 'Txn ID', '交易号', '取引ID', '거래 ID')}</TableHead>
                      <TableHead>{tr('Nội dung CK', 'Transfer memo', '转账备注', '振込摘要', '이체 적요')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsResult.rows.map((row) => {
                      const at = row.completed_at || row.created_at || ''
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
                          <TableCell className="max-w-[160px] truncate text-xs" title={row.full_name ?? ''}>
                            {row.full_name ?? '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatVnd(row.amount, uiLocale)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatCredits(row.credits_added, uiLocale)}</TableCell>
                          <TableCell className="max-w-[140px] truncate font-mono text-xs" title={row.transaction_id ?? ''}>
                            {row.transaction_id ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-xs" title={row.transaction_content ?? ''}>
                            {row.transaction_content ?? '—'}
                          </TableCell>
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
